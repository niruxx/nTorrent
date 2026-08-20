use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use librqbit::Api;

use crate::commands::torrents::{AddTorrentInput, add_torrent_impl};
use crate::settings::SettingsStore;

const POLL_INTERVAL: Duration = Duration::from_secs(10);

/// Polls `Settings.watched_folder` (when set) for `.torrent` files and
/// auto-adds any new ones, moving each into a `.processed` subfolder
/// afterward so it isn't re-added on the next tick. A non-destructive move
/// (not a delete) so a mistake here doesn't lose the user's file.
pub fn spawn(api: Api, settings: Arc<SettingsStore>) {
    tauri::async_runtime::spawn(async move {
        // Skip files we already tried this run even if moving them failed,
        // so a persistently-unmovable file doesn't get re-added every tick.
        let mut seen_this_run: HashSet<std::path::PathBuf> = HashSet::new();
        loop {
            tokio::time::sleep(POLL_INTERVAL).await;
            let Some(folder) = settings.get().await.watched_folder else {
                continue;
            };
            let dir = std::path::PathBuf::from(&folder);
            let mut entries = match tokio::fs::read_dir(&dir).await {
                Ok(e) => e,
                Err(e) => {
                    tracing::warn!("watched folder {folder}: {e}");
                    continue;
                }
            };

            let processed_dir = dir.join(".processed");
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                let is_torrent = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .is_some_and(|e| e.eq_ignore_ascii_case("torrent"));
                if !is_torrent || seen_this_run.contains(&path) {
                    continue;
                }
                seen_this_run.insert(path.clone());

                let input = AddTorrentInput::Path { path: path.display().to_string() };
                match add_torrent_impl(&api, &settings, input, false, false, None).await {
                    Ok(added) => {
                        let name = added.details.name.unwrap_or_else(|| added.details.info_hash.clone());
                        tracing::info!("watched folder: added {name}");
                        if let Some(file_name) = path.file_name() {
                            if tokio::fs::create_dir_all(&processed_dir).await.is_ok() {
                                let _ = tokio::fs::rename(&path, processed_dir.join(file_name)).await;
                            }
                        }
                    }
                    Err(e) => tracing::warn!("watched folder: failed to add {}: {e}", path.display()),
                }
            }
        }
    });
}
