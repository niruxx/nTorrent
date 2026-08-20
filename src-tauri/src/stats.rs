use std::sync::Arc;
use std::time::Duration;

use librqbit::Api;

use crate::settings::SettingsStore;

const CHECKPOINT_INTERVAL: Duration = Duration::from_secs(20);

/// librqbit's own session counters (`fetched_bytes`/`uploaded_bytes`) reset
/// to 0 every launch. This periodically folds their delta since the last
/// tick into `Settings.alltime_*_bytes`, so "all-time" totals actually
/// survive restarts instead of just reflecting the current run.
pub fn spawn(api: Api, settings: Arc<SettingsStore>) {
    tauri::async_runtime::spawn(async move {
        let mut last_downloaded = 0u64;
        let mut last_uploaded = 0u64;
        loop {
            tokio::time::sleep(CHECKPOINT_INTERVAL).await;

            let snapshot = api.api_session_stats();
            let downloaded = snapshot.counters.fetched_bytes;
            let uploaded = snapshot.counters.uploaded_bytes;
            let delta_down = downloaded.saturating_sub(last_downloaded);
            let delta_up = uploaded.saturating_sub(last_uploaded);
            last_downloaded = downloaded;
            last_uploaded = uploaded;

            if delta_down == 0 && delta_up == 0 {
                continue;
            }
            let result = settings
                .update(|s| {
                    s.alltime_downloaded_bytes = s.alltime_downloaded_bytes.saturating_add(delta_down);
                    s.alltime_uploaded_bytes = s.alltime_uploaded_bytes.saturating_add(delta_up);
                })
                .await;
            if let Err(e) = result {
                tracing::warn!("failed to persist all-time stats: {e:#}");
            }
        }
    });
}
