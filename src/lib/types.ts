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

export interface NetworkInterfaceInfo {
  name: string;
  friendly_name: string | null;
  description: string | null;
  ipv4: string[];
  has_gateway: boolean;
  vpn_hint: string | null;
}

export interface Settings {
  onboarding_completed: boolean;
  theme: ThemeMode;
  download_dir: string | null;
  bind_interface: string | null;
  download_limit_kbps: number | null;
  upload_limit_kbps: number | null;
  schedule_enabled: boolean;
  schedule: ScheduleRule[];
  portmap_provider: PortmapProvider;
  pia_gateway: string | null;
  pia_token: string | null;
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
