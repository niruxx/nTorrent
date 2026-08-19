import { motion } from "motion/react";
import { useMemo } from "react";
import { useSettingsStore } from "../stores/settings";
import { useUiStore, type Section } from "../stores/ui";
import { Logo } from "./Logo";

interface NavEntry {
  id: Section;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavEntry[] = [
  { id: "library", label: "Library", icon: "grid_view" },
  { id: "downloading", label: "Downloading", icon: "downloading" },
  { id: "seeding", label: "Seeding", icon: "upload" },
  { id: "completed", label: "Completed", icon: "task_alt" },
];

const TOOL_NAV_ITEMS: NavEntry[] = [
  { id: "search", label: "Search", icon: "travel_explore" },
  { id: "rss", label: "RSS rules", icon: "rss_feed" },
];

const BOTTOM_NAV_ITEMS: NavEntry[] = [
  { id: "network", label: "Network & VPN", icon: "vpn_lock" },
  { id: "settings", label: "Settings", icon: "settings" },
];

function NavButton({ item }: { item: NavEntry }) {
  const active = useUiStore((s) => s.section === item.id && s.labelFilter === null);
  const setSection = useUiStore((s) => s.setSection);

  return (
    <button
      onClick={() => setSection(item.id)}
      className={`relative flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
        active ? "text-accent-blue-dark" : "text-ink-muted hover:bg-surface-hover"
      }`}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-full bg-accent-blue/12"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <span className="material-symbols-rounded relative z-10 text-[20px]">{item.icon}</span>
      <span className="relative z-10">{item.label}</span>
    </button>
  );
}

function LabelButton({ label }: { label: string }) {
  const active = useUiStore((s) => s.labelFilter === label);
  const setLabelFilter = useUiStore((s) => s.setLabelFilter);

  return (
    <button
      onClick={() => setLabelFilter(active ? null : label)}
      className={`relative flex w-full items-center gap-3 rounded-full px-4 py-2 text-sm transition-colors ${
        active ? "bg-accent-blue/12 text-accent-blue-dark font-medium" : "text-ink-muted hover:bg-surface-hover"
      }`}
    >
      <span className="material-symbols-rounded text-[18px]">label</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export function Sidebar() {
  const torrentLabels = useSettingsStore((s) => s.settings.torrent_labels);
  const allLabels = useMemo(
    () => Array.from(new Set(Object.values(torrentLabels).flat())).sort(),
    [torrentLabels],
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col justify-between bg-surface-sidebar px-3 py-4">
      <div className="min-h-0 overflow-y-auto">
        <div className="flex items-center px-3 pt-2 pb-6">
          <Logo size={38} />
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
        </nav>

        {allLabels.length > 0 && (
          <div className="mt-4">
            <p className="px-4 pb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">
              Labels
            </p>
            <nav className="flex flex-col gap-0.5">
              {allLabels.map((label) => (
                <LabelButton key={label} label={label} />
              ))}
            </nav>
          </div>
        )}

        <div className="mt-4">
          <nav className="flex flex-col gap-1">
            {TOOL_NAV_ITEMS.map((item) => (
              <NavButton key={item.id} item={item} />
            ))}
          </nav>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}
      </nav>
    </aside>
  );
}
