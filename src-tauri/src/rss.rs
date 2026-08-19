use std::io::Cursor;
use std::sync::Arc;
use std::time::Duration;

use librqbit::{AddTorrent, AddTorrentOptions, Api};
use regex::Regex;

use crate::settings::SettingsStore;

const SEEN_CAP: usize = 500;

pub fn spawn(api: Api, settings: Arc<SettingsStore>) {
    tauri::async_runtime::spawn(async move {
        loop {
            poll_once(&api, &settings).await;
            let poll_minutes = settings.get().await.rss_poll_minutes.max(1) as u64;
            tokio::time::sleep(Duration::from_secs(poll_minutes * 60)).await;
        }
    });
}

async fn poll_once(api: &Api, settings: &SettingsStore) {
    let s = settings.get().await;
    if s.rss_feeds.is_empty() || s.rss_rules.is_empty() {
        return;
    }

    let mut newly_seen = Vec::new();

    for feed in s.rss_feeds.iter().filter(|f| f.enabled) {
        let items = match fetch_feed(&feed.url).await {
            Ok(items) => items,
            Err(e) => {
                tracing::warn!("failed to fetch RSS feed {}: {e:#}", feed.url);
                continue;
            }
        };

        for item in items {
            let key = item.guid.clone().unwrap_or_else(|| item.link.clone());
            if s.rss_seen.contains(&key) || newly_seen.contains(&key) {
                continue;
            }

            let matching_rule = s.rss_rules.iter().find(|r| {
                r.enabled
                    && (r.feed_id.is_none() || r.feed_id.as_deref() == Some(feed.id.as_str()))
                    && Regex::new(&r.pattern)
                        .map(|re| re.is_match(&item.title))
                        .unwrap_or(false)
            });

            if let Some(rule) = matching_rule {
                newly_seen.push(key);
                let add = AddTorrent::from_url(item.link.clone());
                let opts = AddTorrentOptions {
                    paused: rule.paused_on_add,
                    overwrite: true,
                    ..Default::default()
                };
                match api.api_add_torrent(add, Some(opts)).await {
                    Ok(_) => tracing::info!("RSS auto-added: {}", item.title),
                    Err(e) => tracing::warn!("RSS auto-add failed for {}: {e:#}", item.title),
                }
            }
        }
    }

    if !newly_seen.is_empty() {
        let _ = settings
            .update(|s| {
                s.rss_seen.extend(newly_seen);
                let len = s.rss_seen.len();
                if len > SEEN_CAP {
                    s.rss_seen.drain(0..len - SEEN_CAP);
                }
            })
            .await;
    }
}

struct FeedItem {
    title: String,
    link: String,
    guid: Option<String>,
}

async fn fetch_feed(url: &str) -> anyhow::Result<Vec<FeedItem>> {
    let bytes = reqwest::get(url).await?.bytes().await?;
    let channel = rss::Channel::read_from(Cursor::new(&bytes[..]))?;
    Ok(channel
        .items()
        .iter()
        .filter_map(|item| {
            let title = item.title()?.to_string();
            let link = item.link()?.to_string();
            let guid = item.guid().map(|g| g.value().to_string());
            Some(FeedItem { title, link, guid })
        })
        .collect())
}
