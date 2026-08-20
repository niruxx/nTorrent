//! Enforces `Settings.max_active_downloads`. librqbit has no built-in
//! concept of "N active, rest queued" (confirmed against the crate — only a
//! per-torrent peer limit and a checking-concurrency limit exist), so this
//! polls the torrent list and pauses/resumes torrents itself to approximate
//! it, using plain `pause`/`resume` — never touching files.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use librqbit::TorrentStatsState;
use librqbit::Api;
use librqbit::api::{ApiTorrentListOpts, TorrentIdOrHash};

use crate::settings::SettingsStore;

const CHECK_INTERVAL: Duration = Duration::from_secs(5);

pub fn spawn(api: Api, settings: Arc<SettingsStore>) {
    tauri::async_runtime::spawn(async move {
        // Info-hashes we ourselves paused to enforce the cap — so we only
        // ever auto-resume torrents we queued, never one the user paused by
        // hand, and we forget about a torrent the moment the user acts on
        // it (removed, or manually resumed).
        let mut queued_by_us: HashSet<String> = HashSet::new();
        loop {
            tokio::time::sleep(CHECK_INTERVAL).await;

            let Some(max) = settings.get().await.max_active_downloads else {
                queued_by_us.clear();
                continue;
            };
            let max = max as usize;

            let list = api.api_torrent_list_ext(ApiTorrentListOpts { with_stats: true });
            let mut torrents = list.torrents;
            torrents.sort_by_key(|t| t.id);

            let live_hashes: HashSet<&str> = torrents
                .iter()
                .filter(|t| matches!(t.stats.as_ref().map(|s| &s.state), Some(TorrentStatsState::Live)))
                .map(|t| t.info_hash.as_str())
                .collect();
            // A torrent we paused that the user resumed by hand (or that
            // finished/vanished) is no longer ours to manage.
            queued_by_us.retain(|h| {
                torrents.iter().any(|t| t.info_hash == *h && !live_hashes.contains(t.info_hash.as_str()))
            });

            let downloading: Vec<&librqbit::api::TorrentDetailsResponse> = torrents
                .iter()
                .filter(|t| {
                    t.stats
                        .as_ref()
                        .is_some_and(|s| matches!(s.state, TorrentStatsState::Live) && !s.finished)
                })
                .collect();

            if downloading.len() > max {
                for t in downloading.iter().skip(max) {
                    if let Some(id) = t.id {
                        if api.api_torrent_action_pause(TorrentIdOrHash::Id(id)).await.is_ok() {
                            queued_by_us.insert(t.info_hash.clone());
                        }
                    }
                }
            } else if downloading.len() < max && !queued_by_us.is_empty() {
                let mut slots = max - downloading.len();
                for t in &torrents {
                    if slots == 0 {
                        break;
                    }
                    if !queued_by_us.contains(&t.info_hash) {
                        continue;
                    }
                    if let Some(id) = t.id {
                        if api.api_torrent_action_start(TorrentIdOrHash::Id(id)).await.is_ok() {
                            queued_by_us.remove(&t.info_hash);
                            slots -= 1;
                        }
                    }
                }
            }
        }
    });
}
