import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { formatBytes, formatEta, formatSpeed } from "../lib/format";
import { isPaused, progressPercent } from "../lib/torrent-filters";
import { getTorrentDetails, getTorrentTrackers, getTrackerFavicon } from "../lib/tauri-bridge";
import type { TorrentDetailsResponse, TorrentDetailsResponseFile } from "../lib/types";
import { useSettingsStore } from "../stores/settings";
import { useSnackbarStore } from "../stores/snackbar";
import { type SpeedSample, torrentKey, useTorrentsStore } from "../stores/torrents";
import { useUiStore } from "../stores/ui";
import { ConfirmRemoveDialog } from "./ConfirmRemoveDialog";
import { PeersPanel } from "./PeersPanel";
import { SpeedSparkline } from "./SpeedSparkline";

type Tab = "files" | "trackers" | "peers";

export function DetailOverlay() {
  const detailId = useUiStore((s) => s.detailId);
  const closeDetail = useUiStore((s) => s.closeDetail);
  const torrents = useTorrentsStore((s) => s.torrents);
  const speedHistory = useTorrentsStore((s) => s.speedHistory);

  const torrent = useMemo(
    () => torrents.find((t) => torrentKey(t) === detailId) ?? null,
    [torrents, detailId],
  );

  return (
    <AnimatePresence>
      {detailId && torrent && (
        <DrawerContent
          key="drawer"
          detailId={detailId}
          torrent={torrent}
          history={speedHistory[detailId] ?? []}
          onClose={closeDetail}
        />
      )}
    </AnimatePresence>
  );
}

function DrawerContent({
  detailId,
  torrent,
  history,
  onClose,
}: {
  detailId: string;
  torrent: TorrentDetailsResponse;
  history: SpeedSample[];
  onClose: () => void;
}) {
  const pause = useTorrentsStore((s) => s.pause);
  const resume = useTorrentsStore((s) => s.resume);
  const remove = useTorrentsStore((s) => s.remove);
  const setFilePriorityAction = useTorrentsStore((s) => s.setFilePriority);
  const pushSnackbar = useSnackbarStore((s) => s.push);

  const [details, setDetails] = useState<TorrentDetailsResponse | null>(null);
  const [trackers, setTrackers] = useState<string[] | null>(null);
  const [tab, setTab] = useState<Tab>("files");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const id = torrent.id ?? torrent.info_hash;
  const name = torrent.name ?? torrent.info_hash;

  useEffect(() => {
    getTorrentDetails(id)
      .then(setDetails)
      .catch(() => {});
    getTorrentTrackers(id)
      .then(setTrackers)
      .catch(() => setTrackers([]));
    // `id` is a primitive derived from `torrent`, so this only re-fires when
    // the torrent actually changes, not on every stats tick.
  }, [detailId, id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hideZero = useSettingsStore((s) => s.settings.hide_zero_values);
  const showSpeedGraphs = useSettingsStore((s) => s.settings.enable_speed_graphs);
  const percent = progressPercent(torrent);
  const paused = isPaused(torrent);
  const files = details?.files ?? [];
  const downSpeed = torrent.stats?.live?.download_speed.mbps ?? 0;
  const upSpeed = torrent.stats?.live?.upload_speed.mbps ?? 0;
  const livePeers = torrent.stats?.live?.snapshot.peer_stats.live ?? 0;

  async function toggleFile(index: number) {
    if (!details?.files) return;
    const nextIncluded = details.files.map((f, i) => (i === index ? !f.included : f.included));
    setDetails({
      ...details,
      files: details.files.map((f, i) => (i === index ? { ...f, included: !f.included } : f)),
    });
    const indices = nextIncluded.flatMap((inc, i) => (inc ? [i] : []));
    await setFilePriorityAction(id, indices);
  }

  async function handleDelete(deleteFiles: boolean) {
    await remove(id, deleteFiles);
    pushSnackbar(deleteFiles ? `Deleted "${name}" and its files` : `Removed "${name}"`);
    setConfirmingDelete(false);
    onClose();
  }

  return (
    <>
      <motion.div
        key="drawer-backdrop"
        className="fixed inset-0 z-40 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-card bg-surface-elevated shadow-overlay"
      >
        <div className="flex shrink-0 justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-subtle" />
        </div>

        <header className="flex shrink-0 items-center gap-3 border-b border-subtle px-6 py-4">
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-hover"
            title="Close"
          >
            <span className="material-symbols-rounded text-[20px]">keyboard_arrow_down</span>
          </button>
          <h2 className="min-w-0 flex-1 truncate text-base font-medium text-ink" title={name}>
            {name}
          </h2>
          <button
            onClick={() => (paused ? resume(id) : pause(id))}
            className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-hover"
            title={paused ? "Start" : "Pause"}
          >
            <span className="material-symbols-rounded text-[20px]">
              {paused ? "play_arrow" : "pause"}
            </span>
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-accent-red/10 hover:text-accent-red"
            title="Delete"
          >
            <span className="material-symbols-rounded text-[20px]">delete</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-2xl font-medium text-ink">{percent.toFixed(1)}%</span>
            <span className="text-sm text-ink-muted">
              {formatBytes(torrent.stats?.progress_bytes ?? 0)} /{" "}
              {formatBytes(torrent.stats?.total_bytes ?? 0)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
            <motion.div
              className="h-full rounded-full bg-accent-blue"
              animate={{ width: `${Math.min(100, percent)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 24 }}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Download"
              value={hideZero && downSpeed === 0 ? "—" : formatSpeed(downSpeed * 1024 * 1024)}
            />
            <Stat
              label="Upload"
              value={hideZero && upSpeed === 0 ? "—" : formatSpeed(upSpeed * 1024 * 1024)}
            />
            <Stat label="Peers" value={hideZero && livePeers === 0 ? "—" : String(livePeers)} />
            <Stat label="ETA" value={formatEta(torrent.stats?.live?.time_remaining?.duration.secs)} />
          </div>

          {showSpeedGraphs && (
            <div className="mt-6">
              <SpeedSparkline samples={history} />
            </div>
          )}

          <div className="mt-6">
            <LabelEditor infoHash={torrent.info_hash} />
          </div>

          <div className="mt-6">
            <div className="flex gap-1 rounded-full bg-surface-hover p-1">
              <button
                onClick={() => setTab("files")}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                  tab === "files" ? "bg-surface-elevated text-ink shadow-card" : "text-ink-muted"
                }`}
              >
                Files{files.length > 0 ? ` (${files.length})` : ""}
              </button>
              <button
                onClick={() => setTab("trackers")}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                  tab === "trackers" ? "bg-surface-elevated text-ink shadow-card" : "text-ink-muted"
                }`}
              >
                Trackers{trackers && trackers.length > 0 ? ` (${trackers.length})` : ""}
              </button>
              <button
                onClick={() => setTab("peers")}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                  tab === "peers" ? "bg-surface-elevated text-ink shadow-card" : "text-ink-muted"
                }`}
              >
                Peers
              </button>
            </div>

            <div className="mt-3">
              {tab === "peers" && <PeersPanel id={id} active={tab === "peers"} />}
              {tab === "files" && (
                <div className="divide-y divide-subtle rounded-card border border-subtle">
                  {files.length === 0 && (
                    <p className="px-4 py-3 text-sm text-ink-muted">Loading files…</p>
                  )}
                  {files.map((f: TorrentDetailsResponseFile, i: number) => (
                    <label
                      key={f.name + i}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-hover"
                    >
                      <input
                        type="checkbox"
                        checked={f.included}
                        onChange={() => toggleFile(i)}
                        className="size-4 accent-[var(--color-accent-blue)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-ink" title={f.name}>
                        {f.name}
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted">{formatBytes(f.length)}</span>
                    </label>
                  ))}
                </div>
              )}
              {tab === "trackers" && (
                <div className="divide-y divide-subtle rounded-card border border-subtle">
                  {trackers === null && (
                    <p className="px-4 py-3 text-sm text-ink-muted">Loading trackers…</p>
                  )}
                  {trackers?.length === 0 && (
                    <p className="px-4 py-3 text-sm text-ink-muted">No trackers — DHT/PEX only.</p>
                  )}
                  {trackers?.map((url) => <TrackerRow key={url} url={url} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {confirmingDelete && (
        <ConfirmRemoveDialog
          name={name}
          onCancel={() => setConfirmingDelete(false)}
          onKeepFiles={() => handleDelete(false)}
          onDeleteFiles={() => handleDelete(true)}
        />
      )}
    </>
  );
}

// Stable reference so the selector below doesn't hand useSyncExternalStore
// a fresh array on every call (which would loop forever) when a torrent
// has no labels yet.
const EMPTY_LABELS: string[] = [];

function LabelEditor({ infoHash }: { infoHash: string }) {
  const labels = useSettingsStore((s) => s.settings.torrent_labels[infoHash] ?? EMPTY_LABELS);
  const update = useSettingsStore((s) => s.update);
  const allLabels = useSettingsStore((s) => s.settings.torrent_labels);
  const confirmClearAll = useSettingsStore((s) => s.settings.confirm_removal_of_all_tags);
  const [draft, setDraft] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);

  function commit(next: string[]) {
    void update({ torrent_labels: { ...allLabels, [infoHash]: next } });
  }

  function addLabel() {
    const value = draft.trim();
    if (!value || labels.includes(value)) return;
    commit([...labels, value]);
    setDraft("");
  }

  function clearAll() {
    if (confirmClearAll) {
      setConfirmingClear(true);
    } else {
      commit([]);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">Labels</h3>
        {labels.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs font-medium text-ink-muted hover:text-accent-red"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {labels.map((label) => (
          <span
            key={label}
            className="flex items-center gap-1 rounded-full bg-accent-blue/12 px-3 py-1 text-xs font-medium text-accent-blue-dark"
          >
            {label}
            <button
              onClick={() => commit(labels.filter((l) => l !== label))}
              className="grid size-3.5 place-items-center rounded-full hover:bg-accent-blue/20"
            >
              <span className="material-symbols-rounded text-[12px]">close</span>
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLabel()}
          onBlur={addLabel}
          placeholder="Add label…"
          className="w-28 rounded-full border border-subtle bg-surface px-3 py-1 text-xs text-ink outline-none focus:border-accent-blue"
        />
      </div>

      {confirmingClear && (
        <div className="mt-3 flex items-center justify-between rounded-card border border-subtle bg-surface-hover px-3 py-2">
          <p className="text-xs text-ink">Remove all {labels.length} label(s) from this torrent?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmingClear(false)}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-elevated"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                commit([]);
                setConfirmingClear(false);
              }}
              className="rounded-full bg-accent-red px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Remove all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackerRow({ url }: { url: string }) {
  const showFavicon = useSettingsStore((s) => s.settings.download_tracker_favicon);
  const [favicon, setFavicon] = useState<string | null>(null);

  useEffect(() => {
    if (!showFavicon) return;
    let cancelled = false;
    getTrackerFavicon(url)
      .then((b64) => !cancelled && setFavicon(b64))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, showFavicon]);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      {favicon ? (
        <img
          src={`data:image/x-icon;base64,${favicon}`}
          alt=""
          className="size-4 shrink-0 rounded-sm"
        />
      ) : (
        <span className="material-symbols-rounded text-[16px] text-ink-muted">dns</span>
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={url}>
        {url}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
