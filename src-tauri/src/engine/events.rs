use std::sync::Arc;
use std::time::Duration;

use librqbit::Api;
use librqbit::api::{ApiTorrentListOpts, TorrentListResponse};
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;

pub const TORRENT_STATS_EVENT: &str = "torrent://stats";

/// Pushes a full torrent list + live stats snapshot on an interval — to the
/// desktop window via a Tauri event, and onto `tx` for the web UI's
/// WebSocket clients, so neither surface has to poll `list_torrents` itself.
pub fn spawn_stats_broadcaster(app: AppHandle, api: Api, tx: broadcast::Sender<Arc<TorrentListResponse>>) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(1000));
        loop {
            interval.tick().await;
            let snapshot = Arc::new(api.api_torrent_list_ext(ApiTorrentListOpts { with_stats: true }));
            let _ = app.emit(TORRENT_STATS_EVENT, snapshot.clone());
            let _ = tx.send(snapshot);
        }
    });
}
