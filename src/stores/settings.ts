import { create } from "zustand";
import { getSettings, setSettings } from "../lib/tauri-bridge";
import type { Settings, ThemeMode } from "../lib/types";

const DEFAULT_SETTINGS: Settings = {
  onboarding_completed: false,
  file_associations_enabled: false,
  theme: "system",
  download_dir: null,
  bind_interface: null,
  download_limit_kbps: null,
  upload_limit_kbps: null,
  schedule_enabled: false,
  schedule: [],
  portmap_provider: "auto",
  pia_gateway: null,
  pia_token: null,
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
