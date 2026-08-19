use std::collections::HashMap;
use std::path::PathBuf;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ThemeMode {
    Light,
    Dark,
    #[default]
    System,
}

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PortmapProvider {
    /// NAT-PMP/PCP, then UPnP, whichever succeeds first.
    #[default]
    Auto,
    Pia,
    Off,
}

/// A time-of-day bandwidth rule, e.g. "cap uploads 9am-5pm on weekdays".
/// Minutes are minutes-since-midnight in the user's local time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleRule {
    pub start_minute: u16,
    pub end_minute: u16,
    pub download_limit_kbps: Option<u32>,
    pub upload_limit_kbps: Option<u32>,
}

/// An RSS/Atom feed to poll for new items.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssFeed {
    pub id: String,
    pub url: String,
    pub enabled: bool,
}

/// A rule matching item titles (regex) from one feed (or all feeds, if
/// `feed_id` is None) that should be auto-added when matched.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssRule {
    pub id: String,
    pub feed_id: Option<String>,
    pub pattern: String,
    pub enabled: bool,
    pub paused_on_add: bool,
}

/// A user-defined search engine URL template. `{query}` is replaced with
/// the URL-encoded search text. No indexers are bundled — the user adds
/// their own, keeping this a neutral general-purpose client.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchProvider {
    pub id: String,
    pub name: String,
    pub url_template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Whether the first-run setup screen has been completed. False on a
    /// fresh install; the frontend shows the onboarding flow until this
    /// becomes true.
    pub onboarding_completed: bool,
    /// Register nTorrent as the OS handler for `.torrent` files and
    /// `magnet:` links. Applied (and self-healed, in case the app binary
    /// moved) every time settings are saved and once on launch.
    pub file_associations_enabled: bool,
    pub theme: ThemeMode,
    /// None = use the OS Downloads folder.
    pub download_dir: Option<String>,
    /// Network device name to bind all torrent traffic to (e.g. a VPN
    /// tun/wg adapter), so traffic can't leak outside the tunnel. None =
    /// no binding, use the OS default route. Takes effect on next launch.
    pub bind_interface: Option<String>,
    pub download_limit_kbps: Option<u32>,
    pub upload_limit_kbps: Option<u32>,
    pub schedule_enabled: bool,
    pub schedule: Vec<ScheduleRule>,
    pub portmap_provider: PortmapProvider,
    pub pia_gateway: Option<String>,
    pub pia_token: Option<String>,
    pub web_ui_enabled: bool,
    pub web_ui_port: u16,
    /// false = bind 127.0.0.1 only. true = bind 0.0.0.0 (reachable from the
    /// LAN — only meaningful once the user has actually set a token).
    pub web_ui_bind_all: bool,
    /// Bearer token required for every /api request and the WebSocket.
    /// Auto-generated the first time the web UI is enabled if unset.
    pub web_ui_token: Option<String>,
    pub rss_feeds: Vec<RssFeed>,
    pub rss_rules: Vec<RssRule>,
    pub rss_poll_minutes: u32,
    /// Bounded history of already-handled item GUIDs/links, so a restart
    /// doesn't re-add everything the next feed poll sees.
    pub rss_seen: Vec<String>,
    pub search_providers: Vec<SearchProvider>,
    /// info_hash -> labels.
    pub torrent_labels: HashMap<String, Vec<String>>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            onboarding_completed: false,
            file_associations_enabled: false,
            theme: ThemeMode::default(),
            download_dir: None,
            bind_interface: None,
            download_limit_kbps: None,
            upload_limit_kbps: None,
            schedule_enabled: false,
            schedule: Vec::new(),
            portmap_provider: PortmapProvider::default(),
            pia_gateway: None,
            pia_token: None,
            web_ui_enabled: false,
            web_ui_port: 3030,
            web_ui_bind_all: false,
            web_ui_token: None,
            rss_feeds: Vec::new(),
            rss_rules: Vec::new(),
            rss_poll_minutes: 15,
            rss_seen: Vec::new(),
            search_providers: Vec::new(),
            torrent_labels: HashMap::new(),
        }
    }
}

pub struct SettingsStore {
    path: PathBuf,
    current: RwLock<Settings>,
}

impl SettingsStore {
    pub async fn load(path: PathBuf) -> Self {
        let current = match tokio::fs::read(&path).await {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
            Err(_) => Settings::default(),
        };
        Self {
            path,
            current: RwLock::new(current),
        }
    }

    pub async fn get(&self) -> Settings {
        self.current.read().await.clone()
    }

    pub async fn set(&self, settings: Settings) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .context("create settings directory")?;
        }
        let bytes = serde_json::to_vec_pretty(&settings).context("serialize settings")?;
        tokio::fs::write(&self.path, bytes)
            .await
            .context("write settings file")?;
        *self.current.write().await = settings;
        Ok(())
    }

    /// Atomic read-modify-write-persist, for callers that only need to
    /// tweak a slice of settings (RSS dedupe bookkeeping, label edits)
    /// without round-tripping the whole struct through the frontend.
    pub async fn update(&self, f: impl FnOnce(&mut Settings)) -> Result<()> {
        let mut next = self.get().await;
        f(&mut next);
        self.set(next).await
    }
}
