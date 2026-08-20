import { create } from "zustand";
import { getSettings, setSettings } from "../lib/tauri-bridge";
import type { Settings, ThemeMode } from "../lib/types";

const DEFAULT_SETTINGS: Settings = {
  onboarding_completed: false,
  file_associations_enabled: false,
  theme: "system",
  background_animation: "none",
  language: "en",
  hide_zero_values: false,
  torrent_order: [],
  alltime_downloaded_bytes: 0,
  alltime_uploaded_bytes: 0,
  download_dir: null,
  incomplete_download_dir: null,
  bind_interface: null,
  listen_port: null,
  download_limit_kbps: null,
  upload_limit_kbps: null,
  schedule_enabled: false,
  schedule: [],
  portmap_provider: "auto",
  pia_gateway: null,
  pia_token: null,
  max_active_downloads: null,
  global_max_connections: null,
  content_layout: "original",
  torrent_stop_condition: "none",
  delete_torrent_file_after_add: false,
  copy_torrent_files_to: null,
  append_incomplete_extension: false,
  keep_unselected_in_unwanted_folder: false,
  recursive_download_dialog_enabled: false,
  watched_folder: null,
  show_free_space_in_status_bar: false,
  show_external_ip_in_status_bar: false,

  dht_enabled: true,
  dht_bootstrap_nodes: [
    "dht.libtorrent.org:25401",
    "dht.transmissionbt.com:6881",
    "router.bittorrent.com:6881",
  ],
  pex_enabled: true,
  local_peer_discovery_enabled: true,
  proxy_enabled: false,
  proxy_host: null,
  proxy_port: null,
  proxy_username: null,
  proxy_password: null,
  ip_filter_enabled: false,
  ip_filter_blocklist_url: null,
  ip_filter_allowlist_url: null,
  ip_filter_apply_to_trackers: false,
  rate_limit_exempt_lan_peers: false,
  rate_limit_account_protocol_overhead: false,

  torrent_verification_enabled: true,
  process_memory_priority: "normal",
  torrent_filesize_limit_mb: null,
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
  web_ui_token: null,
  rss_feeds: [],
  rss_rules: [],
  rss_poll_minutes: 15,
  rss_seen: [],
  search_providers: [],
  torrent_labels: {},
};

function resolveIsDark(theme: ThemeMode): boolean {
  if (theme === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return theme === "dark";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", resolveIsDark(theme));
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  saving: boolean;
  init: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
}

let initPromise: Promise<void> | null = null;

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  saving: false,

  init: () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        const settings = await getSettings();
        applyTheme(settings.theme);
        set({ settings, loaded: true });
      } catch {
        applyTheme("system");
        set({ loaded: true });
      }
    })();
    return initPromise;
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next, saving: true });
    if (patch.theme) applyTheme(patch.theme);
    try {
      await setSettings(next);
    } finally {
      set({ saving: false });
    }
  },

  // Instant local theme toggle (used by the top-bar quick toggle), persisted
  // through the same backend-backed `update` path.
  setTheme: (theme) => {
    void get().update({ theme });
  },
}));

applyTheme("system");

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (useSettingsStore.getState().settings.theme === "system") {
    applyTheme("system");
  }
});
