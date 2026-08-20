import { useT } from "../lib/useT";
import { useSettingsStore } from "../stores/settings";
import { useUiStore, type SortMode } from "../stores/ui";

const GRID_SECTIONS = new Set(["library", "downloading", "seeding", "completed"]);

const SORT_LABELS: Record<SortMode, string> = {
  added: "Recently added",
  custom: "Custom order",
  name: "Name",
  size: "Size",
  progress: "Progress",
};

function ThemeToggle() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={theme === "system" ? "Using system theme" : `Theme: ${theme}`}
      className="grid size-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover"
    >
      <span className="material-symbols-rounded text-[22px]">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}

function DensityToggle() {
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);

  return (
    <button
      onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
      title="Toggle grid density"
      className="grid size-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover"
    >
      <span className="material-symbols-rounded text-[22px]">
        {density === "comfortable" ? "view_comfy" : "view_compact"}
      </span>
    </button>
  );
}

function SortMenu() {
  const sortMode = useUiStore((s) => s.sortMode);
  const setSortMode = useUiStore((s) => s.setSortMode);

  return (
    <select
      value={sortMode}
      onChange={(e) => setSortMode(e.target.value as SortMode)}
      title="Sort torrents"
      className="h-10 rounded-full border border-subtle bg-surface px-3 text-sm text-ink outline-none"
    >
      {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
        <option key={mode} value={mode}>
          {SORT_LABELS[mode]}
        </option>
      ))}
    </select>
  );
}

export function TopBar() {
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const setAddDialogOpen = useUiStore((s) => s.setAddDialogOpen);
  const setCreateDialogOpen = useUiStore((s) => s.setCreateDialogOpen);
  const section = useUiStore((s) => s.section);
  const t = useT();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 px-6">
      <div className="flex h-11 flex-1 max-w-xl items-center gap-3 rounded-full bg-surface-hover px-4 transition-colors focus-within:bg-surface-elevated focus-within:shadow-card">
        <span className="material-symbols-rounded text-[20px] text-ink-muted">search</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("search_placeholder")}
          className="h-full flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      <div className="flex-1" />

      {GRID_SECTIONS.has(section) && <SortMenu />}
      <DensityToggle />
      <ThemeToggle />

      <button
        onClick={() => setCreateDialogOpen(true)}
        title={t("create_torrent")}
        className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover"
      >
        <span className="material-symbols-rounded text-[22px]">note_add</span>
      </button>

      <button
        onClick={() => setAddDialogOpen(true)}
        className="ml-1 flex h-10 items-center gap-2 rounded-full bg-accent-blue px-5 text-sm font-medium text-white shadow-card transition-[box-shadow,transform] hover:shadow-card-hover active:scale-95"
      >
        <span className="material-symbols-rounded text-[20px]">add</span>
        {t("add_torrent")}
      </button>
    </header>
  );
}
