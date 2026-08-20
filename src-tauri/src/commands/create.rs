use std::path::PathBuf;

use librqbit::spawn_utils::BlockingSpawner;
use librqbit::{CreateTorrentOptions, create_torrent};
use tauri::State;

use crate::state::AppState;

#[derive(serde::Deserialize)]
pub struct CreateTorrentRequest {
    /// A single file or folder to create the torrent from — librqbit walks
    /// folders recursively and includes everything it finds.
    pub source_path: String,
    pub name: Option<String>,
    pub trackers: Vec<String>,
    pub piece_length: Option<u32>,
    /// Where to write the resulting `.torrent` file.
    pub output_path: String,
}

#[derive(serde::Serialize)]
pub struct CreateTorrentResponse {
    pub info_hash: String,
    pub magnet: String,
    pub output_path: String,
}

#[tauri::command]
pub async fn create_torrent_file(
    _state: State<'_, AppState>,
    req: CreateTorrentRequest,
) -> Result<CreateTorrentResponse, String> {
    create_torrent_impl(req).await
}

/// Shared between the Tauri command and the web UI's HTTP handler.
pub async fn create_torrent_impl(req: CreateTorrentRequest) -> Result<CreateTorrentResponse, String> {
    // A tiny, one-off pool — torrent creation is a rare, user-triggered
    // action, not worth sharing librqbit's own internal (private) spawner.
    let spawner = BlockingSpawner::new(2);
    let path = PathBuf::from(&req.source_path);
    let opts = CreateTorrentOptions {
        name: req.name.as_deref(),
        trackers: req.trackers.clone(),
        piece_length: req.piece_length,
    };

    let result = create_torrent(&path, opts, &spawner).await.map_err(|e| e.to_string())?;
    let bytes = result.as_bytes().map_err(|e| e.to_string())?;
    tokio::fs::write(&req.output_path, &bytes[..])
        .await
        .map_err(|e| format!("failed to write {}: {e}", req.output_path))?;

    Ok(CreateTorrentResponse {
        info_hash: result.info_hash().as_string(),
        magnet: result.as_magnet().to_string(),
        output_path: req.output_path,
    })
}
