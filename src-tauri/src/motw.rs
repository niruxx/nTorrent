//! "Mark of the Web": tags newly-completed downloaded files as
//! internet-sourced via an NTFS `Zone.Identifier` alternate data stream —
//! the same mechanism Windows Explorer/SmartScreen use to warn before
//! opening a file downloaded by a browser. Windows-only; a no-op elsewhere.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use librqbit::Api;
use librqbit::api::{ApiTorrentListOpts, TorrentIdOrHash};

use crate::settings::SettingsStore;

const CHECK_INTERVAL: Duration = Duration::from_secs(5);
const ZONE_IDENTIFIER: &str = "[ZoneTransfer]\r\nZoneId=3\r\n";

pub fn spawn(api: Api, settings: Arc<SettingsStore>) {
    tauri::async_runtime::spawn(async move {
        let mut marked: HashSet<String> = HashSet::new();
        loop {
            tokio::time::sleep(CHECK_INTERVAL).await;
            if !settings.get().await.enable_mark_of_the_web {
                continue;
            }

            let list = api.api_torrent_list_ext(ApiTorrentListOpts { with_stats: true });
            for t in &list.torrents {
                let finished = t.stats.as_ref().is_some_and(|s| s.finished);
                if !finished || marked.contains(&t.info_hash) {
                    continue;
                }
                marked.insert(t.info_hash.clone());

                let Some(id) = t.id else { continue };
                let Ok(details) = api.api_torrent_details(TorrentIdOrHash::Id(id)) else {
                    continue;
                };
                let Some(files) = details.files else { continue };

                let output_folder = std::path::PathBuf::from(&details.output_folder);
                for f in files.iter().filter(|f| f.included) {
                    let mut path = output_folder.clone();
                    for component in &f.components {
                        path.push(component);
                    }
                    mark_file(&path);
                }
            }
        }
    });
}

#[cfg(target_os = "windows")]
fn mark_file(path: &std::path::Path) {
    let stream_path = format!("{}:Zone.Identifier", path.display());
    if let Err(e) = std::fs::write(&stream_path, ZONE_IDENTIFIER) {
        tracing::warn!("mark-of-the-web {}: {e}", path.display());
    }
}

#[cfg(not(target_os = "windows"))]
fn mark_file(_path: &std::path::Path) {}
