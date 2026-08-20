use std::collections::HashSet;
use std::sync::Arc;

use librqbit::api::{
    ApiAddTorrentResponse, ApiTorrentListOpts, EmptyJsonResponse, TorrentDetailsResponse,
    TorrentIdOrHash, TorrentListResponse,
};
use librqbit::{AddTorrent, AddTorrentOptions, Api, TorrentStats};
use tauri::State;

use crate::settings::{ContentLayout, Settings, SettingsStore, TorrentStopCondition};
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
    settings: &Settings,
    paused: bool,
    list_only: bool,
    only_files: Option<Vec<usize>>,
) -> AddTorrentOptions {
    // librqbit rejects setting both at once (`sub_folder` is only meaningful
    // relative to *its own* default output folder), so content-layout
    // control is only available when the user hasn't overridden the
    // download folder. `Original`/`CreateSubfolder` both just take
    // librqbit's own default (nest multi-file torrents under a folder named
    // after the torrent — the crate doesn't distinguish those two cases).
    let sub_folder = (settings.download_dir.is_none()
        && matches!(settings.content_layout, ContentLayout::DontCreateSubfolder))
    .then(String::new);

    AddTorrentOptions {
        paused,
        overwrite: true,
        output_folder: settings.download_dir.clone(),
        sub_folder,
        list_only,
        only_files,
        peer_limit: settings.global_max_connections.map(|n| n as usize),
        ..Default::default()
    }
}

/// Whether the configured stop condition should hold a newly-added torrent
/// paused rather than letting it start downloading immediately.
///
/// librqbit only exposes one real stopping point: `Initializing` always
/// fetches metadata *and* hash-checks existing data before a torrent can go
/// live, with no way to interrupt strictly after metadata but before
/// checking — so `MetadataReceived` and `FilesChecked` both resolve to the
/// same actual behavior (`AddTorrentOptions.paused`, which lands the torrent
/// in `Paused` right after `Initializing` completes instead of `Live`).
pub fn stop_condition_pauses(settings: &Settings) -> bool {
    !matches!(settings.torrent_stop_condition, TorrentStopCondition::None)
}

/// Everything that needs to happen around adding a torrent beyond the raw
/// librqbit call: applying the stop-condition/content-layout/connection-limit
/// settings, and — once it's actually added (not just a `list_only` preview)
/// — copying the source `.torrent` bytes to a configured folder and/or
/// deleting the source file. Shared by the Tauri command and the web UI's
/// HTTP handler.
pub async fn add_torrent_impl(
    api: &Api,
    settings_store: &Arc<SettingsStore>,
    input: AddTorrentInput,
    paused: bool,
    list_only: bool,
    only_files: Option<Vec<usize>>,
) -> Result<ApiAddTorrentResponse, String> {
    let settings = settings_store.get().await;

    let source_path = match &input {
        AddTorrentInput::Path { path } => Some(path.clone()),
        _ => None,
    };
    let torrent_bytes = match &input {
        AddTorrentInput::File { bytes } => Some(bytes.clone()),
        AddTorrentInput::Path { path } => tokio::fs::read(path).await.ok(),
        AddTorrentInput::Uri { .. } => None,
    };

    // Only enforceable for File/Path inputs — a magnet link's size isn't
    // known until metadata arrives.
    if let (Some(limit_mb), Some(bytes)) = (settings.torrent_filesize_limit_mb, &torrent_bytes) {
        let limit_bytes = limit_mb as usize * 1024 * 1024;
        if bytes.len() > limit_bytes {
            return Err(format!(
                ".torrent file is {:.1} MB, over the {limit_mb} MB limit set in Settings",
                bytes.len() as f64 / (1024.0 * 1024.0)
            ));
        }
    }

    let effective_paused = paused || (!list_only && stop_condition_pauses(&settings));

    let add = resolve_add_torrent(input).await?;
    let opts = build_add_options(&settings, effective_paused, list_only, only_files);
    let result = api.api_add_torrent(add, Some(opts)).await.map_err(|e| e.to_string())?;

    if !list_only {
        if let (Some(dir), Some(bytes)) = (&settings.copy_torrent_files_to, &torrent_bytes) {
            let file_name = format!("{}.torrent", result.details.name.as_deref().unwrap_or(&result.details.info_hash));
            let dest = std::path::Path::new(dir).join(sanitize_file_name(&file_name));
            if let Err(e) = tokio::fs::create_dir_all(dir).await {
                tracing::warn!("copy .torrent to {dir}: {e}");
            } else if let Err(e) = tokio::fs::write(&dest, bytes).await {
                tracing::warn!("copy .torrent to {}: {e}", dest.display());
            }
        }
        if settings.delete_torrent_file_after_add {
            if let Some(path) = &source_path {
                if let Err(e) = tokio::fs::remove_file(path).await {
                    tracing::warn!("delete source .torrent {path}: {e}");
                }
            }
        }
    }

    Ok(result)
}

/// Strips path separators out of a torrent name before using it as a file
/// name, so a maliciously-named torrent can't write outside the target folder.
fn sanitize_file_name(name: &str) -> String {
    name.chars().map(|c| if matches!(c, '/' | '\\' | ':') { '_' } else { c }).collect()
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
    add_torrent_impl(&state.api, &state.settings, input, paused, list_only, only_files).await
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

/// A flattened, JS-friendly view of librqbit's per-peer stats: the raw API
/// keys peers by a `SocketAddr`-formatted string (bracketed for IPv6), so we
/// split that into `ip`/`port` here rather than making the frontend do it.
#[derive(serde::Serialize)]
pub struct PeerInfo {
    pub addr: String,
    pub ip: String,
    pub port: u16,
    pub client_name: Option<String>,
    pub state: String,
    pub conn_kind: Option<String>,
    pub downloaded_bytes: u64,
    pub uploaded_bytes: u64,
    /// Reverse-DNS PTR result, when `Settings.resolve_peer_hostnames` is on.
    pub hostname: Option<String>,
}

#[tauri::command]
pub async fn get_torrent_peers(
    state: State<'_, AppState>,
    id: TorrentIdOrHash,
) -> Result<Vec<PeerInfo>, String> {
    get_torrent_peers_impl(&state.api, &state.settings, id).await
}

/// Shared between the Tauri command and the web UI's HTTP handler.
pub async fn get_torrent_peers_impl(
    api: &librqbit::Api,
    settings_store: &SettingsStore,
    id: TorrentIdOrHash,
) -> Result<Vec<PeerInfo>, String> {
    let snapshot = api.api_peer_stats(id, Default::default()).map_err(|e| e.to_string())?;
    let resolve_hostnames = settings_store.get().await.resolve_peer_hostnames;

    let mut peers: Vec<PeerInfo> = snapshot
        .peers
        .into_iter()
        .map(|(addr, stats)| {
            let (ip, port) = addr
                .parse::<std::net::SocketAddr>()
                .map(|sa| (sa.ip().to_string(), sa.port()))
                .unwrap_or_else(|_| (addr.clone(), 0));
            PeerInfo {
                addr,
                ip,
                port,
                client_name: stats.client_name,
                state: stats.state.to_string(),
                conn_kind: stats.conn_kind.map(|k| k.to_string()),
                downloaded_bytes: stats.counters.fetched_bytes,
                uploaded_bytes: stats.counters.uploaded_bytes,
                hostname: None,
            }
        })
        .collect();
    peers.sort_by_key(|p| std::cmp::Reverse(p.downloaded_bytes));

    if resolve_hostnames {
        resolve_hostnames_in_place(&mut peers).await;
    }
    Ok(peers)
}

/// Reverse-DNS-resolves each peer's IP concurrently, with a short per-lookup
/// timeout so one slow/unresponsive DNS server can't stall the whole list.
async fn resolve_hostnames_in_place(peers: &mut [PeerInfo]) {
    use std::time::Duration;

    let mut set = tokio::task::JoinSet::new();
    for (i, p) in peers.iter().enumerate() {
        let Ok(addr) = p.ip.parse::<std::net::IpAddr>() else { continue };
        set.spawn(async move {
            let hostname = tokio::time::timeout(
                Duration::from_millis(800),
                tokio::task::spawn_blocking(move || dns_lookup::lookup_addr(&addr).ok()),
            )
            .await
            .ok()
            .and_then(|r| r.ok())
            .flatten();
            (i, hostname)
        });
    }
    while let Some(result) = set.join_next().await {
        if let Ok((i, hostname)) = result {
            peers[i].hostname = hostname;
        }
    }
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
