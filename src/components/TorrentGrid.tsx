import { AnimatePresence, Reorder } from "motion/react";
import { matchesSearch, matchesSection, sortTorrents } from "../lib/torrent-filters";
import { useSettingsStore } from "../stores/settings";
import { torrentKey, useTorrentsStore } from "../stores/torrents";
import { useUiStore } from "../stores/ui";
import { EmptyState } from "./EmptyState";
import { TorrentCard } from "./TorrentCard";

const SECTION_EMPTY: Record<string, { icon: string; title: string; subtitle: string }> = {
  library: {
    icon: "grid_view",
    title: "No torrents yet",
    subtitle: "Add a magnet link or a .torrent file to get started.",
  },
  downloading: {
    icon: "downloading",
    title: "Nothing downloading",
    subtitle: "Active downloads will show up here.",
  },
  seeding: {
    icon: "upload",
    title: "Nothing seeding",
    subtitle: "Completed torrents you're sharing will show up here.",
  },
  completed: {
    icon: "task_alt",
    title: "Nothing completed yet",
    subtitle: "Finished torrents will show up here.",
  },
};

/** Applies the user's saved custom order, appending any torrent that isn't
 * in it yet (new adds) at the end, and dropping any stale keys. */
function applyCustomOrder<T extends { key: string }>(items: T[], order: string[]): T[] {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const ordered: T[] = [];
  for (const key of order) {
    const item = byKey.get(key);
    if (item) {
      ordered.push(item);
      byKey.delete(key);
    }
  }
  ordered.push(...byKey.values());
  return ordered;
}

export function TorrentGrid() {
  const torrents = useTorrentsStore((s) => s.torrents);
  const loading = useTorrentsStore((s) => s.loading);
  const error = useTorrentsStore((s) => s.error);
  const section = useUiStore((s) => s.section);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const density = useUiStore((s) => s.density);
  const labelFilter = useUiStore((s) => s.labelFilter);
  const sortMode = useUiStore((s) => s.sortMode);
  const labels = useSettingsStore((s) => s.settings.torrent_labels);
  const torrentOrder = useSettingsStore((s) => s.settings.torrent_order);
  const updateSettings = useSettingsStore((s) => s.update);

  const filtered = sortTorrents(
    torrents.filter(
      (t) =>
        matchesSection(t, section) &&
        matchesSearch(t, searchQuery) &&
        (!labelFilter || (labels[t.info_hash] ?? []).includes(labelFilter)),
    ),
    sortMode,
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="material-symbols-rounded animate-spin text-[28px] text-ink-muted">
          progress_activity
        </span>
      </div>
    );
  }

  if (error) {
    return <EmptyState icon="error" title="Couldn't load torrents" subtitle={error} />;
  }

  if (filtered.length === 0) {
    const empty = labelFilter
      ? { icon: "label", title: `No torrents labeled "${labelFilter}"`, subtitle: "" }
      : (SECTION_EMPTY[section] ?? SECTION_EMPTY.library);
    return <EmptyState icon={empty.icon} title={empty.title} subtitle={empty.subtitle} />;
  }

  if (sortMode === "custom") {
    const withKeys = applyCustomOrder(
      filtered.map((t) => ({ key: torrentKey(t), torrent: t })),
      torrentOrder,
    );
    const keys = withKeys.map((w) => w.key);

    return (
      <Reorder.Group
        as="div"
        axis="y"
        values={keys}
        onReorder={(nextKeys) => void updateSettings({ torrent_order: nextKeys })}
        className="flex flex-col gap-3 pt-4"
      >
        {withKeys.map(({ key, torrent }) => (
          <Reorder.Item key={key} value={key} as="div">
            <TorrentCard torrentKey={key} torrent={torrent} />
          </Reorder.Item>
        ))}
      </Reorder.Group>
    );
  }

  return (
    <div
      className={`grid gap-4 pt-4 ${
        density === "comfortable"
          ? "grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
          : "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
      }`}
    >
      <AnimatePresence initial={false}>
        {filtered.map((t, index) => {
          const key = torrentKey(t);
          return <TorrentCard key={key} torrentKey={key} torrent={t} index={index} />;
        })}
      </AnimatePresence>
    </div>
  );
}
