use std::collections::HashSet;

use librqbit::api::{
    ApiAddTorrentResponse, ApiTorrentListOpts, EmptyJsonResponse, TorrentDetailsResponse,
    TorrentIdOrHash, TorrentListResponse,
};
use librqbit::{AddTorrent, AddTorrentOptions, TorrentStats};
use tauri::State;

use crate::state::AppState;

/// What the frontend can hand us to start a new torrent: a URI (magnet link
/// or an http(s) URL pointing at a .torrent file), the raw bytes of a
/// .torrent file picked via a browser file input, or a local filesystem
/// path (from native OS drag-and-drop, which only ever gives us paths — so
/// this variant only makes sense from the desktop window, not the web UI).
#[derive(serde::Deserialize)]
#[serde(tag = "kind")]
pub enum AddTorrentInput {
    Uri { uri: String },
    File { bytes: Vec<u8> },
    Path { path: String },
}

/// Shared between the Tauri command and the web UI's HTTP handler.
pub async fn resolve_add_torrent(input: AddTorrentInput) -> Result<AddTorrent<'static>, String> {
    Ok(match input {
        AddTorrentInput::Uri { uri } => AddTorrent::from_url(uri),
        AddTorrentInput::File { bytes } => AddTorrent::from_bytes(bytes),
        AddTorrentInput::Path { path } => {
            let bytes = tokio::fs::read(&path)
                .await
                .map_err(|e| format!("failed to read {path}: {e}"))?;
            AddTorrent::from_bytes(bytes)
        }
    })
}

/// `list_only` fetches metadata (and the file list) without starting the
/// download — used by the add-torrent dialog's file-picker preview step.
/// `only_files`, when set, restricts the actual download to those file
/// indices — used once the user confirms their selection.
pub fn build_add_options(
    download_dir: Option<String>,
    paused: bool,
    list_only: bool,
    only_files: Option<Vec<usize>>,
) -> AddTorrentOptions {
    AddTorrentOptions {
        paused,
        overwrite: true,
        output_folder: download_dir,
        list_only,
        only_files,
        ..Default::default()
    }
}

#[tauri::command]
pub fn list_torrents(state: State<AppState>) -> TorrentListResponse {
    state
        .api
        .api_torrent_list_ext(ApiTorrentListOpts { with_stats: true })
}

#[tauri::command]
pub fn get_torrent_details(
    state: State<AppState>,
    id: TorrentIdOrHash,
) -> Result<TorrentDetailsResponse, String> {
    state.api.api_torrent_details(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_torrent_stats(
    state: State<AppState>,
    id: TorrentIdOrHash,
) -> Result<TorrentStats, String> {
    state.api.api_stats_v1(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_torrent(
    state: State<'_, AppState>,
    input: AddTorrentInput,
    paused: bool,
    list_only: bool,
    only_files: Option<Vec<usize>>,
) -> Result<ApiAddTorrentResponse, String> {
    let add = resolve_add_torrent(input).await?;
    let output_folder = state.settings.get().await.download_dir;
    let opts = build_add_options(output_folder, paused, list_only, only_files);
    state
        .api
        .api_add_torrent(add, Some(opts))
        .await
        .map_err(|e| e.to_string())
}

/// Tracker URLs configured for a torrent (from its .torrent/magnet plus any
/// session-wide default trackers).
#[tauri::command]
pub fn get_torrent_trackers(
    state: State<AppState>,
    id: TorrentIdOrHash,
) -> Result<Vec<String>, String> {
    let handle = state.api.mgr_handle(id).map_err(|e| e.to_string())?;
    Ok(handle.shared().trackers.iter().map(|u| u.to_string()).collect())
}

#[tauri::command]
pub async fn pause_torrent(
    state: State<'_, AppState>,
    id: TorrentIdOrHash,
) -> Result<EmptyJsonResponse, String> {
    state
        .api
        .api_torrent_action_pause(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resume_torrent(
    state: State<'_, AppState>,
    id: TorrentIdOrHash,
) -> Result<EmptyJsonResponse, String> {
    state
        .api
        .api_torrent_action_start(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_torrent(
    state: State<'_, AppState>,
    id: TorrentIdOrHash,
    delete_files: bool,
) -> Result<EmptyJsonResponse, String> {
    let result = if delete_files {
        state.api.api_torrent_action_delete(id).await
    } else {
        state.api.api_torrent_action_forget(id).await
    };
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_file_priority(
    state: State<'_, AppState>,
    id: TorrentIdOrHash,
    file_indices: Vec<usize>,
) -> Result<EmptyJsonResponse, String> {
    let only_files: HashSet<usize> = file_indices.into_iter().collect();
    state
        .api
        .api_torrent_action_update_only_files(id, &only_files)
        .await
        .map_err(|e| e.to_string())
}
