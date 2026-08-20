use tauri::State;

use crate::settings::SettingsStore;
use crate::state::AppState;

/// Fetches `https://<tracker's host>/favicon.ico` and returns it as base64
/// for the Trackers tab to render inline — gated by
/// `Settings.download_tracker_favicon` on the frontend.
#[tauri::command]
pub async fn get_tracker_favicon(
    state: State<'_, AppState>,
    tracker_url: String,
) -> Result<String, String> {
    get_tracker_favicon_impl(&state.settings, tracker_url).await
}

/// Shared between the Tauri command and the web UI's HTTP handler.
pub async fn get_tracker_favicon_impl(
    settings_store: &SettingsStore,
    tracker_url: String,
) -> Result<String, String> {
    let settings = settings_store.get().await;
    let host = tracker_url
        .parse::<url::Url>()
        .ok()
        .and_then(|u| u.host_str().map(str::to_string))
        .ok_or_else(|| "couldn't parse tracker host".to_string())?;

    let http = crate::http_client::build_client(settings.ignore_ssl_errors);
    let bytes = http
        .get(format!("https://{host}/favicon.ico"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}
