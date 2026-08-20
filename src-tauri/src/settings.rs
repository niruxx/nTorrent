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
pub enum BackgroundAnimation {
    #[default]
    None,
    Snowfall,
    /// A slow-drifting wave/ripple motif reminiscent of the PS3 XMB dashboard.
    Xmb,
    /// A subtle breathing gradient — animated, but deliberately understated.
    Minimal,
}

/// How a multi-file torrent's files are laid out under the download
/// directory. `Original`/`CreateSubfolder` both use librqbit's default
/// (files nested under a folder named after the torrent, per the standard
/// BitTorrent multi-file layout) — the crate doesn't distinguish them.
/// `DontCreateSubfolder` flattens files directly into the output folder.
#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContentLayout {
    #[default]
    Original,
    CreateSubfolder,
    DontCreateSubfolder,
}

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TorrentStopCondition {
    #[default]
    None,
    MetadataReceived,
    FilesChecked,
}

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProcessMemoryPriority {
    #[default]
    Normal,
    BelowNormal,
    Idle,
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
    pub background_animation: BackgroundAnimation,
    /// UI language, as a BCP-47-ish tag ("en", "es", "fr", "de").
    pub language: String,
    /// Hide 0 and infinite (∞) values (speeds, ETA, ratio) instead of showing them.
    pub hide_zero_values: bool,
    /// Torrent info-hashes in the user's custom manual order, used when the
    /// library's sort mode is "custom" (drag-to-reorder).
    pub torrent_order: Vec<String>,
    /// Running totals accumulated across restarts (librqbit's own session
    /// counters reset to 0 every launch) — see `stats::spawn`.
    pub alltime_downloaded_bytes: u64,
    pub alltime_uploaded_bytes: u64,
    /// None = use the OS Downloads folder.
    pub download_dir: Option<String>,
    /// Separate directory in-progress downloads are written to before being
    /// moved to `download_dir` on completion. None = write directly to the
    /// final location. **Not yet enforced** — saved as a preference; wiring
    /// it up safely needs a custom librqbit storage hook (see
    /// `append_incomplete_extension`'s doc comment for why that's deferred).
    pub incomplete_download_dir: Option<String>,
    /// Network device name to bind all torrent traffic to (e.g. a VPN
    /// tun/wg adapter), so traffic can't leak outside the tunnel. None =
    /// no binding, use the OS default route. Takes effect on next launch.
    pub bind_interface: Option<String>,
    /// A specific TCP/UDP port to listen on. None = let the OS pick one.
    /// librqbit only binds its listener once, at startup, so this — like
    /// `bind_interface` — takes effect on next launch, not live.
    pub listen_port: Option<u16>,
    pub download_limit_kbps: Option<u32>,
    pub upload_limit_kbps: Option<u32>,
    pub schedule_enabled: bool,
    pub schedule: Vec<ScheduleRule>,
    pub portmap_provider: PortmapProvider,
    pub pia_gateway: Option<String>,
    pub pia_token: Option<String>,
    /// How many torrents may be actively downloading (not paused/finished)
    /// at once — extras are held paused and auto-resumed as slots free up.
    /// None = unlimited (librqbit has no built-in queueing, so this is
    /// enforced by us — see `queue.rs`).
    pub max_active_downloads: Option<u32>,
    /// Applied as each torrent's own peer limit when it's added (librqbit
    /// has no single knob spanning all torrents at once, only a per-torrent
    /// one) — so this caps connections *per torrent*, not truly globally.
    pub global_max_connections: Option<u32>,
    pub content_layout: ContentLayout,
    pub torrent_stop_condition: TorrentStopCondition,
    /// Delete the source `.torrent` file after it's been added (only
    /// applies when adding from a local file path, not a magnet/URL/upload).
    pub delete_torrent_file_after_add: bool,
    /// Save a copy of every added `.torrent` file's bytes into this folder.
    pub copy_torrent_files_to: Option<String>,
    /// Rename in-progress files with a `.!qB`-style suffix until they
    /// finish. **Not yet enforced** — this needs a custom librqbit
    /// `TorrentStorage` wrapper (the crate has no built-in support), and
    /// renaming files the engine may still hold open is easy to get wrong
    /// in ways that risk corrupting an in-progress download, so it's saved
    /// as a preference for now rather than rushed.
    pub append_incomplete_extension: bool,
    /// Route files deselected in the review screen into a `.unwanted`
    /// subfolder instead of the main output folder. **Not yet enforced**,
    /// same reason as `append_incomplete_extension`.
    pub keep_unselected_in_unwanted_folder: bool,
    /// When a completed download itself contains `.torrent` files, prompt
    /// to add those too.
    pub recursive_download_dialog_enabled: bool,
    /// A directory to watch for new `.torrent` files and auto-add them.
    pub watched_folder: Option<String>,
    pub show_free_space_in_status_bar: bool,
    pub show_external_ip_in_status_bar: bool,

    // --- Connection: DHT / PEX / LSD / proxy / IP filtering ---
    /// Session-wide; takes effect on next launch (librqbit only sets this
    /// up once, at session construction).
    pub dht_enabled: bool,
    /// Empty = librqbit's own built-in bootstrap nodes.
    pub dht_bootstrap_nodes: Vec<String>,
    /// Peer exchange. **Not enforceable** — librqbit has no PEX toggle at
    /// all; it's unconditionally on for every non-private torrent. Saved so
    /// the setting exists for when/if the crate adds one.
    pub pex_enabled: bool,
    /// Local Peer Discovery (LAN multicast peer announce). Session-wide;
    /// takes effect on next launch.
    pub local_peer_discovery_enabled: bool,
    pub proxy_enabled: bool,
    /// SOCKS5 only (what librqbit supports) — applies to both peer
    /// connections and tracker HTTP announces. Takes effect on next launch.
    pub proxy_host: Option<String>,
    pub proxy_port: Option<u16>,
    pub proxy_username: Option<String>,
    pub proxy_password: Option<String>,
    pub ip_filter_enabled: bool,
    /// `http(s)://` or `file://` URL to a PeerGuardian-style IP range list.
    /// Loaded once at launch (librqbit has no live-reload hook).
    pub ip_filter_blocklist_url: Option<String>,
    pub ip_filter_allowlist_url: Option<String>,
    /// **Not distinguished by the engine** — librqbit's blocklist only ever
    /// gates peer connections; there's no evidence it (or anything else
    /// here) applies to tracker announces separately. Saved for UI
    /// completeness.
    pub ip_filter_apply_to_trackers: bool,
    /// **Not enforceable** — librqbit's rate limiter has no LAN-exemption
    /// hook (see `rate_limit_account_protocol_overhead`'s doc comment).
    pub rate_limit_exempt_lan_peers: bool,
    /// **Not enforceable** — librqbit's limiter has no separate
    /// payload-vs-protocol-overhead accounting, and no per-transport
    /// (TCP vs uTP) limit; only one global upload/download number each
    /// exists (`download_limit_kbps`/`upload_limit_kbps` above).
    pub rate_limit_account_protocol_overhead: bool,

    // --- Advanced tab ---
    /// **Not enforceable** — librqbit always hash-checks a torrent's data
    /// during its `Initializing` state; there's no way to skip it.
    pub torrent_verification_enabled: bool,
    pub process_memory_priority: ProcessMemoryPriority,
    /// Reject `.torrent` files larger than this when adding from local
    /// bytes/a path (not enforceable for magnet links — no size is known
    /// before metadata arrives). None = unlimited.
    pub torrent_filesize_limit_mb: Option<u32>,
    /// **Not enforceable** — librqbit has no force-recheck API; the only
    /// way to re-verify is remove-and-re-add, which we won't do silently.
    pub recheck_on_completion: bool,
    /// How often the desktop window's live torrent-list event fires.
    pub refresh_interval_ms: u32,
    pub resolve_peer_hostnames: bool,
    /// **Not enforceable** — would need a bundled GeoIP database or an
    /// external lookup service; neither is wired up.
    pub resolve_peer_countries: bool,
    pub confirm_removal_of_all_tags: bool,
    /// **Not enforceable yet** — there's no bulk "remove this tracker from
    /// every torrent" action in the app for this to gate.
    pub confirm_removal_of_tracker_from_all_torrents: bool,
    /// **Not enforceable** — librqbit has no reannounce-now API.
    pub reannounce_on_ip_port_change: bool,
    pub download_tracker_favicon: bool,
    pub enable_speed_graphs: bool,
    pub enable_embedded_tracker: bool,
    pub embedded_tracker_port: u16,
    /// **Not enforced yet** — would need generalizing our port-mapping
    /// manager to map a second port; it only maps the torrent listen port
    /// today.
    pub embedded_tracker_port_forwarding: bool,
    /// Windows only: tag newly-completed downloaded files as
    /// internet-sourced (the same mechanism Explorer/SmartScreen use to
    /// warn before opening them), via an NTFS `Zone.Identifier` stream.
    pub enable_mark_of_the_web: bool,
    /// Applies to nTorrent's own HTTPS calls (RSS feeds, search, tracker
    /// favicons, the PIA API) — not a torrent-protocol setting.
    pub ignore_ssl_errors: bool,

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
            background_animation: BackgroundAnimation::default(),
            language: "en".to_string(),
            hide_zero_values: false,
            torrent_order: Vec::new(),
            alltime_downloaded_bytes: 0,
            alltime_uploaded_bytes: 0,
            download_dir: None,
            incomplete_download_dir: None,
            bind_interface: None,
            listen_port: None,
            download_limit_kbps: None,
            upload_limit_kbps: None,
            schedule_enabled: false,
            schedule: Vec::new(),
            portmap_provider: PortmapProvider::default(),
            pia_gateway: None,
            pia_token: None,
            max_active_downloads: None,
            global_max_connections: None,
            content_layout: ContentLayout::default(),
            torrent_stop_condition: TorrentStopCondition::default(),
            delete_torrent_file_after_add: false,
            copy_torrent_files_to: None,
            append_incomplete_extension: false,
            keep_unselected_in_unwanted_folder: false,
            recursive_download_dialog_enabled: false,
            watched_folder: None,
            show_free_space_in_status_bar: false,
            show_external_ip_in_status_bar: false,

            dht_enabled: true,
            dht_bootstrap_nodes: vec![
                "dht.libtorrent.org:25401".to_string(),
                "dht.transmissionbt.com:6881".to_string(),
                "router.bittorrent.com:6881".to_string(),
            ],
            pex_enabled: true,
            local_peer_discovery_enabled: true,
            proxy_enabled: false,
            proxy_host: None,
            proxy_port: None,
            proxy_username: None,
            proxy_password: None,
            ip_filter_enabled: false,
            ip_filter_blocklist_url: None,
            ip_filter_allowlist_url: None,
            ip_filter_apply_to_trackers: false,
            rate_limit_exempt_lan_peers: false,
            rate_limit_account_protocol_overhead: false,

            torrent_verification_enabled: true,
            process_memory_priority: ProcessMemoryPriority::default(),
            torrent_filesize_limit_mb: None,
            recheck_on_completion: false,
            refresh_interval_ms: 1500,
            resolve_peer_hostnames: true,
            resolve_peer_countries: true,
            confirm_removal_of_all_tags: true,
            confirm_removal_of_tracker_from_all_torrents: true,
            reannounce_on_ip_port_change: false,
            download_tracker_favicon: false,
            enable_speed_graphs: true,
            enable_embedded_tracker: false,
            embedded_tracker_port: 9000,
            embedded_tracker_port_forwarding: false,
            enable_mark_of_the_web: true,
            ignore_ssl_errors: false,

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
