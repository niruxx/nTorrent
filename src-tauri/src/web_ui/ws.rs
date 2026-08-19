use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::Response;
use librqbit::api::{ApiTorrentListOpts, TorrentListResponse};
use serde::Serialize;

use crate::portmap::PortMapStatus;

use super::WebState;

#[derive(Serialize)]
#[serde(tag = "kind", content = "payload")]
enum WsEvent<'a> {
    #[serde(rename = "torrent_stats")]
    TorrentStats(&'a TorrentListResponse),
    #[serde(rename = "portmap_status")]
    PortmapStatus(&'a PortMapStatus),
}

pub async fn ws_handler(State(state): State<WebState>, ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: WebState) {
    let mut stats_rx = state.stats_tx.subscribe();
    let mut portmap_rx = state.portmap.subscribe();

    // Send an immediate snapshot so the client doesn't wait out the first tick.
    let initial = state.api.api_torrent_list_ext(ApiTorrentListOpts { with_stats: true });
    if send(&mut socket, &WsEvent::TorrentStats(&initial)).await.is_err() {
        return;
    }
    let initial_portmap = state.portmap.current_status().await;
    if send(&mut socket, &WsEvent::PortmapStatus(&initial_portmap)).await.is_err() {
        return;
    }

    loop {
        tokio::select! {
            stats = stats_rx.recv() => {
                match stats {
                    Ok(snapshot) => {
                        if send(&mut socket, &WsEvent::TorrentStats(&snapshot)).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            status = portmap_rx.recv() => {
                match status {
                    Ok(status) => {
                        if send(&mut socket, &WsEvent::PortmapStatus(&status)).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }
}

async fn send(socket: &mut WebSocket, event: &WsEvent<'_>) -> Result<(), axum::Error> {
    let text = serde_json::to_string(event).unwrap_or_default();
    socket.send(Message::Text(text.into())).await
}
