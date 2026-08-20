// Mirrors the serde JSON shapes produced by librqbit's `Api` facade
// (src-tauri/src/commands/torrents.rs, librqbit::api / librqbit::torrent_state::stats).

export type TorrentIdOrHash = number | string;

export interface FileDetailsAttrs {
  [key: string]: unknown;
}

export interface TorrentDetailsResponseFile {
  name: string;
  components: string[];
  length: number;
  included: boolean;
  attributes: FileDetailsAttrs;
}

export type TorrentRunState = "initializing" | "live" | "paused" | "error";

export interface Speed {
  mbps: number;
  human_readable: string;
}

export interface DurationJson {
  secs: number;
  nanos: number;
}

export interface DurationWithHumanReadable {
  duration: DurationJson;
  human_readable: string;
}

export interface AggregatePeerStats {
  queued: number;
  connecting: number;
  live: number;
  live_tcp: number;
  live_utp: number;
  live_socks: number;
  seen: number;
  dead: number;
  not_needed: number;
  steals: number;
}

export interface StatsSnapshot {
  downloaded_and_checked_bytes: number;
  fetched_bytes: number;
  uploaded_bytes: number;
  downloaded_and_checked_pieces: number;
  total_piece_download_ms: number;
  peer_stats: AggregatePeerStats;
}

export interface LiveStats {
  snapshot: StatsSnapshot;
  average_piece_download_time: DurationJson | null;
  download_speed: Speed;
  upload_speed: Speed;
  time_remaining: DurationWithHumanReadable | null;
}

export interface TorrentStats {
  state: TorrentRunState;
  /** Only present when state === "initializing". */
  initializing_paused?: boolean;
  file_progress: number[];
  error: string | null;
  progress_bytes: number;
  uploaded_bytes: number;
  total_bytes: number;
  finished: boolean;
  live: LiveStats | null;
}

export interface TorrentDetailsResponse {
  id?: number;
  info_hash: string;
  name?: string;
  output_folder: string;
  total_pieces: number;
  files?: TorrentDetailsResponseFile[];
  stats?: TorrentStats;
}

export interface TorrentListResponse {
  torrents: TorrentDetailsResponse[];
}

export interface ApiAddTorrentResponse {
  id?: number;
  details: TorrentDetailsResponse;
  output_folder: string;
  seen_peers?: string[];
}

export type PortMapMethod = "nat_pmp" | "upnp" | "pia";

export interface PortMapStatus {
  active: boolean;
  method: PortMapMethod | null;
  internal_port: number;
  external_port: number | null;
  external_ip: string | null;
  gateway: string | null;
  lease_secs: number | null;
  last_error: string | null;
  updated_at_ms: number;
}

export type ThemeMode = "light" | "dark" | "system";
export type BackgroundAnimation = "none" | "snowfall" | "xmb" | "minimal";
export type PortmapProvider = "auto" | "pia" | "off";

export interface ScheduleRule {
  start_minute: number;
  end_minute: number;
  download_limit_kbps: number | null;
  upload_limit_kbps: number | null;
}

export interface RssFeed {
  id: string;
  url: string;
  enabled: boolean;
}

export interface RssRule {
  id: string;
  feed_id: string | null;
  pattern: string;
  enabled: boolean;
  paused_on_add: boolean;
}

export interface SearchProvider {
  id: string;
  name: string;
  url_template: string;
}

export interface PeerInfo {
  addr: string;
  ip: string;
  port: number;
  client_name: string | null;
  state: string;
  conn_kind: string | null;
  downloaded_bytes: number;
  uploaded_bytes: number;
  hostname: string | null;
}

export interface SessionCountersSnapshot {
  fetched_bytes: number;
  uploaded_bytes: number;
  blocked_incoming: number;
  blocked_outgoing: number;
}

export interface SessionStatsSnapshot {
  counters: SessionCountersSnapshot;
  download_speed: Speed;
  upload_speed: Speed;
  peers: AggregatePeerStats;
  uptime_seconds: number;
  connections: Record<string, unknown>;
}

export interface StatsResponse extends SessionStatsSnapshot {
  alltime_downloaded_bytes: number;
  alltime_uploaded_bytes: number;
}

export interface CreateTorrentRequest {
  source_path: string;
  name: string | null;
  trackers: string[];
  piece_length: number | null;
  output_path: string;
}

export interface CreateTorrentResponse {
  info_hash: string;
  magnet: string;
  output_path: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  friendly_name: string | null;
  description: string | null;
  ipv4: string[];
  has_gateway: boolean;
  vpn_hint: string | null;
}

export type ContentLayout = "original" | "create_subfolder" | "dont_create_subfolder";
export type TorrentStopCondition = "none" | "metadata_received" | "files_checked";
export type ProcessMemoryPriority = "normal" | "below_normal" | "idle";

export interface Settings {
  onboarding_completed: boolean;
  file_associations_enabled: boolean;
  theme: ThemeMode;
  background_animation: BackgroundAnimation;
  language: string;
  hide_zero_values: boolean;
  torrent_order: string[];
  alltime_downloaded_bytes: number;
  alltime_uploaded_bytes: number;
  download_dir: string | null;
  incomplete_download_dir: string | null;
  bind_interface: string | null;
  listen_port: number | null;
  download_limit_kbps: number | null;
  upload_limit_kbps: number | null;
  schedule_enabled: boolean;
  schedule: ScheduleRule[];
  portmap_provider: PortmapProvider;
  pia_gateway: string | null;
  pia_token: string | null;
  max_active_downloads: number | null;
  global_max_connections: number | null;
  content_layout: ContentLayout;
  torrent_stop_condition: TorrentStopCondition;
  delete_torrent_file_after_add: boolean;
  copy_torrent_files_to: string | null;
  append_incomplete_extension: boolean;
  keep_unselected_in_unwanted_folder: boolean;
  recursive_download_dialog_enabled: boolean;
  watched_folder: string | null;
  show_free_space_in_status_bar: boolean;
  show_external_ip_in_status_bar: boolean;

  dht_enabled: boolean;
  dht_bootstrap_nodes: string[];
  pex_enabled: boolean;
  local_peer_discovery_enabled: boolean;
  proxy_enabled: boolean;
  proxy_host: string | null;
  proxy_port: number | null;
  proxy_username: string | null;
  proxy_password: string | null;
  ip_filter_enabled: boolean;
  ip_filter_blocklist_url: string | null;
  ip_filter_allowlist_url: string | null;
  ip_filter_apply_to_trackers: boolean;
  rate_limit_exempt_lan_peers: boolean;
  rate_limit_account_protocol_overhead: boolean;

  torrent_verification_enabled: boolean;
  process_memory_priority: ProcessMemoryPriority;
  torrent_filesize_limit_mb: number | null;
  recheck_on_completion: boolean;
  refresh_interval_ms: number;
  resolve_peer_hostnames: boolean;
  resolve_peer_countries: boolean;
  confirm_removal_of_all_tags: boolean;
  confirm_removal_of_tracker_from_all_torrents: boolean;
  reannounce_on_ip_port_change: boolean;
  download_tracker_favicon: boolean;
  enable_speed_graphs: boolean;
  enable_embedded_tracker: boolean;
  embedded_tracker_port: number;
  embedded_tracker_port_forwarding: boolean;
  enable_mark_of_the_web: boolean;
  ignore_ssl_errors: boolean;

  web_ui_enabled: boolean;
  web_ui_port: number;
  web_ui_bind_all: boolean;
  web_ui_token: string | null;
  rss_feeds: RssFeed[];
  rss_rules: RssRule[];
  rss_poll_minutes: number;
  rss_seen: string[];
  search_providers: SearchProvider[];
  torrent_labels: Record<string, string[]>;
}

export interface DiskSpaceInfo {
  available_bytes: number;
  total_bytes: number;
}
