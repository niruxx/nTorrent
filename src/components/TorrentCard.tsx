import { motion } from "motion/react";
import { useState, type MouseEvent } from "react";
import { formatBytes, formatSpeed } from "../lib/format";
import type { TranslationKey } from "../lib/i18n";
import { isDownloading, isError, isPaused, isSeeding, progressPercent } from "../lib/torrent-filters";
import { useT } from "../lib/useT";
import { useSettingsStore } from "../stores/settings";
import { useSnackbarStore } from "../stores/snackbar";
import { useTorrentsStore } from "../stores/torrents";
import { useUiStore } from "../stores/ui";
import type { TorrentDetailsResponse } from "../lib/types";
import { ConfirmRemoveDialog } from "./ConfirmRemoveDialog";

function statusFor(t: TorrentDetailsResponse): { labelKey: TranslationKey; className: string } {
  if (isError(t)) return { labelKey: "status_error", className: "bg-accent-red/12 text-accent-red" };
  if (isPaused(t)) return { labelKey: "status_paused", className: "bg-ink-muted/12 text-ink-muted" };
  if (isSeeding(t))
    return { labelKey: "status_seeding", className: "bg-accent-green/12 text-accent-green" };
  if (isDownloading(t))
    return { labelKey: "status_downloading", className: "bg-accent-blue/12 text-accent-blue-dark" };
  return { labelKey: "status_queued", className: "bg-ink-muted/12 text-ink-muted" };
}

function barColor(t: TorrentDetailsResponse) {
  if (isError(t)) return "var(--color-accent-red)";
  if (isSeeding(t)) return "var(--color-accent-green)";
  if (isPaused(t)) return "var(--color-ink-muted)";
  return "var(--color-accent-blue)";
}

// A stable reference for "no labels yet" — `?? []` in the selector below
// would otherwise hand useSyncExternalStore a new array every call, which
// it reads as "the store changed" on every render and loops forever.
const EMPTY_LABELS: string[] = [];

export function TorrentCard({
  torrentKey,
  torrent,
  index = 0,
}: {
  torrentKey: string;
  torrent: TorrentDetailsResponse;
  index?: number;
}) {
  const selectedIds = useUiStore((s) => s.selectedIds);
  const toggleSelected = useUiStore((s) => s.toggleSelected);
  const openDetail = useUiStore((s) => s.openDetail);
  const labels = useSettingsStore(
    (s) => s.settings.torrent_labels[torrent.info_hash] ?? EMPTY_LABELS,
  );
  const pause = useTorrentsStore((s) => s.pause);
  const resume = useTorrentsStore((s) => s.resume);
  const remove = useTorrentsStore((s) => s.remove);
  const pushSnackbar = useSnackbarStore((s) => s.push);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const hideZero = useSettingsStore((s) => s.settings.hide_zero_values);
  const t = useT();
  const selected = selectedIds.has(torrentKey);
  const selectionMode = selectedIds.size > 0;
  const status = statusFor(torrent);
  const percent = progressPercent(torrent);
  const name = torrent.name ?? torrent.info_hash;
  const paused = isPaused(torrent);
  const downSpeed = torrent.stats?.live?.download_speed.mbps;
  const upSpeed = torrent.stats?.live?.upload_speed.mbps;

  function handleClick() {
    if (selectionMode) {
      toggleSelected(torrentKey);
    } else {
      openDetail(torrentKey);
    }
  }

  function handleToggleRun(e: MouseEvent) {
    e.stopPropagation();
    void (paused ? resume(torrentKey) : pause(torrentKey));
  }

  function handleRemoveClick(e: MouseEvent) {
    e.stopPropagation();
    setConfirmingDelete(true);
  }

  function handleConfirmRemove(deleteFiles: boolean) {
    setConfirmingDelete(false);
    void remove(torrentKey, deleteFiles).then(() =>
      pushSnackbar(deleteFiles ? `Deleted "${name}" and its files` : `Removed "${name}"`),
    );
  }

  return (
    <>
    <motion.div
      layoutId={`torrent-card-${torrentKey}`}
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      whileHover={{ y: -2 }}
      transition={{
        layout: { type: "spring", stiffness: 420, damping: 34 },
        default: { type: "spring", stiffness: 420, damping: 34, delay: Math.min(index, 12) * 0.02 },
      }}
      onClick={handleClick}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-card bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSelected(torrentKey);
        }}
        className={`absolute left-3 top-3 z-10 grid size-6 place-items-center rounded-full border-2 transition-all ${
          selected
            ? "border-accent-blue bg-accent-blue text-white opacity-100"
            : "border-white bg-black/20 text-transparent opacity-0 group-hover:opacity-100"
        }`}
      >
        <span className="material-symbols-rounded text-[16px]">check</span>
      </button>

      <div
        className={`absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${
          selectionMode ? "hidden" : ""
        }`}
      >
        <button
          onClick={handleToggleRun}
          title={paused ? "Start" : "Pause"}
          className="grid size-7 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
        >
          <span className="material-symbols-rounded text-[16px]">
            {paused ? "play_arrow" : "pause"}
          </span>
        </button>
        <button
          onClick={handleRemoveClick}
          title="Remove"
          className="grid size-7 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-accent-red"
        >
          <span className="material-symbols-rounded text-[16px]">delete</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-hover text-ink-muted">
          <span className="material-symbols-rounded text-[18px]">
            {isSeeding(torrent) ? "upload" : "description"}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink" title={name}>
            {name}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {formatBytes(torrent.stats?.total_bytes ?? 0)} &middot; {percent.toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor(torrent) }}
          initial={false}
          animate={{ width: `${Math.min(100, percent)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
        />
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-ink-muted"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
          {t(status.labelKey)}
        </span>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          {(!hideZero || !!downSpeed) && (
            <span className="flex items-center gap-0.5">
              <span className="material-symbols-rounded text-[14px]">arrow_downward</span>
              {formatSpeed((downSpeed ?? 0) * 1024 * 1024)}
            </span>
          )}
          {(!hideZero || !!upSpeed) && (
            <span className="flex items-center gap-0.5">
              <span className="material-symbols-rounded text-[14px]">arrow_upward</span>
              {formatSpeed((upSpeed ?? 0) * 1024 * 1024)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
    {confirmingDelete && (
      <ConfirmRemoveDialog
        name={name}
        onCancel={() => setConfirmingDelete(false)}
        onKeepFiles={() => handleConfirmRemove(false)}
        onDeleteFiles={() => handleConfirmRemove(true)}
      />
    )}
    </>
  );
}
