use std::sync::Arc;
use std::time::Duration;

use librqbit::Api;
use librqbit::api::{ApiTorrentListOpts, TorrentListResponse};
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;

use crate::settings::SettingsStore;

pub const TORRENT_STATS_EVENT: &str = "torrent://stats";

/// Pushes a full torrent list + live stats snapshot on an interval — to the
/// desktop window via a Tauri event, and onto `tx` for the web UI's
/// WebSocket clients, so neither surface has to poll `list_torrents` itself.
/// The interval is read fresh from `Settings.refresh_interval_ms` every
/// tick, so changing it in Settings applies immediately, no restart needed.
pub fn spawn_stats_broadcaster(
    app: AppHandle,
    api: Api,
    settings: Arc<SettingsStore>,
    tx: broadcast::Sender<Arc<TorrentListResponse>>,
) {
    tauri::async_runtime::spawn(async move {
        loop {
            let interval_ms = settings.get().await.refresh_interval_ms.max(200);
            tokio::time::sleep(Duration::from_millis(interval_ms as u64)).await;
            let snapshot = Arc::new(api.api_torrent_list_ext(ApiTorrentListOpts { with_stats: true }));
            let _ = app.emit(TORRENT_STATS_EVENT, snapshot.clone());
            let _ = tx.send(snapshot);
        }
    });
}
