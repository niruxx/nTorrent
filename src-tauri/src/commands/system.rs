use tauri::State;

use crate::settings::SettingsStore;
use crate::state::AppState;

#[derive(serde::Serialize)]
pub struct DiskSpaceInfo {
    pub available_bytes: u64,
    pub total_bytes: u64,
}

/// Free space on the volume holding the current download directory (or the
/// OS default if none is configured) — for the status bar's "free disk
/// space" indicator.
#[tauri::command]
pub async fn get_disk_space(state: State<'_, AppState>) -> Result<DiskSpaceInfo, String> {
    get_disk_space_impl(&state.settings).await
}

/// Shared between the Tauri command and the web UI's HTTP handler.
pub async fn get_disk_space_impl(settings_store: &SettingsStore) -> Result<DiskSpaceInfo, String> {
    let settings = settings_store.get().await;
    let path = settings
        .download_dir
        .map(std::path::PathBuf::from)
        .filter(|p| p.exists())
        .unwrap_or_else(std::env::temp_dir);

    // The configured folder itself may not exist yet (created lazily on
    // first download) — walk up to the nearest existing ancestor.
    let mut probe = path.as_path();
    while !probe.exists() {
        match probe.parent() {
            Some(parent) => probe = parent,
            None => break,
        }
    }

    Ok(DiskSpaceInfo {
        available_bytes: fs4::available_space(probe).map_err(|e| e.to_string())?,
        total_bytes: fs4::total_space(probe).map_err(|e| e.to_string())?,
    })
}
