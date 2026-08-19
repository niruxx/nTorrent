//! The web UI: the exact same React app the desktop window renders, served
//! over HTTP/WebSocket so it can be opened from a browser (on this machine
//! or, if "Allow LAN access" is on, another device) for remote management.
//! Off by default; every /api request and the WebSocket require the bearer
//! token configured in Settings.

mod assets;
mod handlers;
mod ws;

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use librqbit::Api;
use librqbit::api::TorrentListResponse;
use tokio::sync::{Mutex, broadcast};

use crate::portmap::manager::PortMapManager;
use crate::settings::SettingsStore;

#[derive(Clone)]
pub struct WebState {
    pub api: Api,
    pub settings: Arc<SettingsStore>,
    pub portmap: Arc<PortMapManager>,
    pub web_ui: Arc<WebUiHandle>,
    pub stats_tx: broadcast::Sender<Arc<TorrentListResponse>>,
}

#[derive(Default)]
pub struct WebUiHandle {
    task: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    /// (bind_all, port) the server is currently running with, if any — lets
    /// callers skip a stop/start cycle when nothing web-UI-relevant
    /// actually changed (e.g. an unrelated settings save).
    running_config: Mutex<Option<(bool, u16)>>,
}

impl WebUiHandle {
    pub async fn running_config(&self) -> Option<(bool, u16)> {
        *self.running_config.lock().await
    }

    pub async fn stop(&self) {
        *self.running_config.lock().await = None;
        if let Some(handle) = self.task.lock().await.take() {
            handle.abort();
            // Wait for the task to actually unwind so its TcpListener is
            // dropped (and the port released) before a caller tries to
            // rebind — abort() alone only requests cancellation, it doesn't
            // guarantee the socket is closed by the time it returns.
            let _ = handle.await;
        }
    }

    pub async fn start(&self, state: WebState, bind_all: bool, port: u16) -> Result<()> {
        self.stop().await;

        let host = if bind_all { [0, 0, 0, 0] } else { [127, 0, 0, 1] };
        let addr = SocketAddr::from((host, port));

        let router = build_router(state);
        let listener = tokio::net::TcpListener::bind(addr)
            .await
            .with_context(|| format!("failed to bind web UI to {addr}"))?;

        let handle = tauri::async_runtime::spawn(async move {
            if let Err(e) = axum::serve(listener, router).await {
                tracing::warn!("web UI server stopped: {e:#}");
            }
        });
        *self.task.lock().await = Some(handle);
        *self.running_config.lock().await = Some((bind_all, port));
        Ok(())
    }
}

fn build_router(state: WebState) -> Router {
    let api_router = Router::new()
        .route("/torrents", get(handlers::list_torrents).post(handlers::add_torrent))
        .route(
            "/torrents/{id}",
            get(handlers::get_torrent_details).delete(handlers::remove_torrent),
        )
        .route("/torrents/{id}/stats", get(handlers::get_torrent_stats))
        .route("/torrents/{id}/pause", post(handlers::pause_torrent))
        .route("/torrents/{id}/resume", post(handlers::resume_torrent))
        .route("/torrents/{id}/files", post(handlers::set_file_priority))
        .route("/torrents/{id}/trackers", get(handlers::get_torrent_trackers))
        .route("/vpn/status", get(handlers::get_portmap_status))
        .route("/vpn/refresh", post(handlers::refresh_portmap))
        .route("/network/interfaces", get(handlers::list_network_interfaces))
        .route("/settings", get(handlers::get_settings).put(handlers::set_settings))
        .route("/whoami", get(handlers::whoami))
        .route("/ws", get(ws::ws_handler))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    Router::new()
        .nest("/api", api_router)
        .fallback(assets::static_handler)
        .with_state(state)
}

async fn auth_middleware(State(state): State<WebState>, req: Request, next: Next) -> Response {
    let token = state.settings.get().await.web_ui_token;
    let Some(token) = token.filter(|t| !t.is_empty()) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "web UI token not configured" })),
        )
            .into_response();
    };

    if extract_token(&req).as_deref() == Some(token.as_str()) {
        next.run(req).await
    } else {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "invalid or missing token" })),
        )
            .into_response()
    }
}

/// Accepts the token via `Authorization: Bearer <token>` (used by fetch)
/// or `?token=` (used by the browser WebSocket, which can't set headers).
fn extract_token(req: &Request) -> Option<String> {
    if let Some(auth) = req.headers().get(axum::http::header::AUTHORIZATION) {
        if let Ok(s) = auth.to_str() {
            if let Some(t) = s.strip_prefix("Bearer ") {
                return Some(t.to_string());
            }
        }
    }
    req.uri().query()?.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == "token").then(|| v.to_string())
    })
}

/// A random 32-char hex token, generated the first time the web UI is
/// enabled without one already set.
pub fn generate_token() -> String {
    let bytes: [u8; 16] = rand::random();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
