use std::sync::Arc;

use librqbit::Api;
use librqbit::api::TorrentListResponse;
use tauri::{AppHandle, State};
use tokio::sync::broadcast;

use crate::file_assoc;
use crate::portmap::manager::PortMapManager;
use crate::portmap::pia::PiaConfig;
use crate::scheduler;
use crate::settings::{PortmapProvider, Settings, SettingsStore};
use crate::state::AppState;
use crate::web_ui::{WebState, WebUiHandle};

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    Ok(state.settings.get().await)
}

#[tauri::command]
pub async fn set_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<(), String> {
    apply_settings(
        &app,
        &state.api,
        &state.settings,
        &state.portmap,
        &state.web_ui,
        &state.stats_tx,
        settings,
    )
    .await
}

/// Everything that has to happen when Settings is saved: persist it, apply
/// bandwidth limits immediately, reconfigure port mapping, and start/stop
/// the web UI. Shared by the Tauri command and the web UI's own HTTP
/// handler (so saving Settings from a browser behaves identically).
pub async fn apply_settings(
    app: &AppHandle,
    api: &Api,
    settings_store: &Arc<SettingsStore>,
    portmap: &Arc<PortMapManager>,
    web_ui: &Arc<WebUiHandle>,
    stats_tx: &broadcast::Sender<Arc<TorrentListResponse>>,
    mut settings: Settings,
) -> Result<(), String> {
    if settings.web_ui_enabled && settings.web_ui_token.as_deref().unwrap_or("").is_empty() {
        settings.web_ui_token = Some(crate::web_ui::generate_token());
    }

    settings_store
        .set(settings.clone())
        .await
        .map_err(|e| e.to_string())?;

    file_assoc::apply(app, settings.file_associations_enabled);
    crate::process_priority::apply(settings.process_memory_priority);

    scheduler::apply_current_limits(api, settings_store).await;

    {
        let config_handle = portmap.config_handle();
        let mut cfg = config_handle.write().await;
        cfg.enabled = !matches!(settings.portmap_provider, PortmapProvider::Off);
        cfg.pia = match settings.portmap_provider {
            PortmapProvider::Pia => match (&settings.pia_gateway, &settings.pia_token) {
                (Some(gateway), Some(token)) if !gateway.is_empty() && !token.is_empty() => {
                    gateway.parse().ok().map(|gateway| PiaConfig {
                        gateway,
                        token: token.clone(),
                    })
                }
                _ => None,
            },
            _ => None,
        };
    }
    portmap.request_refresh();

    // Only bounce the web UI server when its own config actually changed —
    // restarting on every settings save (theme, labels, RSS rules, ...) is
    // wasteful and races the OS releasing the old port before the rebind.
    let desired = settings
        .web_ui_enabled
        .then_some((settings.web_ui_bind_all, settings.web_ui_port));
    if web_ui.running_config().await != desired {
        if let Some((bind_all, port)) = desired {
            let web_state = WebState {
                api: api.clone(),
                settings: settings_store.clone(),
                portmap: portmap.clone(),
                web_ui: web_ui.clone(),
                stats_tx: stats_tx.clone(),
                app: app.clone(),
            };
            web_ui.start(web_state, bind_all, port).await.map_err(|e| e.to_string())?;
        } else {
            web_ui.stop().await;
        }
    }

    Ok(())
}
