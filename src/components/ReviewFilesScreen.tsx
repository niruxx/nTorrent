import { motion } from "motion/react";
import { useState } from "react";
import { formatBytes } from "../lib/format";
import { runAddTorrent } from "../lib/addTorrentSource";
import { useSnackbarStore } from "../stores/snackbar";
import { useTorrentsStore } from "../stores/torrents";
import { useUiStore } from "../stores/ui";

export function ReviewFilesScreen() {
  const source = useUiStore((s) => s.reviewSource);
  const preview = useUiStore((s) => s.reviewPreview);
  const paused = useUiStore((s) => s.reviewPaused);
  const closeReview = useUiStore((s) => s.closeReview);
  const addFromUri = useTorrentsStore((s) => s.addFromUri);
  const addFromBytes = useTorrentsStore((s) => s.addFromBytes);
  const addFromPath = useTorrentsStore((s) => s.addFromPath);
  const pushSnackbar = useSnackbarStore((s) => s.push);

  const files = preview?.details.files ?? [];
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(files.map((_, i) => i)),
  );
  const [submitting, setSubmitting] = useState(false);

  if (!source || !preview) return null;

  async function handleAdd() {
    setSubmitting(true);
    try {
      await runAddTorrent(
        { addFromUri, addFromBytes, addFromPath },
        source!,
        { paused, onlyFiles: Array.from(selected) },
      );
      pushSnackbar("Torrent added");
      closeReview();
    } catch (e) {
      pushSnackbar(`Couldn't add torrent: ${String(e)}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl pt-6">
      <div className="rounded-card bg-surface p-6 shadow-card">
        <h2 className="truncate text-lg font-medium text-ink">{preview.details.name ?? "Choose files"}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Pick which files to download. You can change this later from the torrent's detail view.
        </p>

        <div className="mt-4 flex items-center gap-3 text-xs">
          <button
            onClick={() => setSelected(new Set(files.map((_, i) => i)))}
            className="font-medium text-accent-blue-dark hover:underline"
          >
            Select all
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="font-medium text-ink-muted hover:underline"
          >
            Select none
          </button>
          <span className="ml-auto text-ink-muted">
            {selected.size} of {files.length} selected
          </span>
        </div>

        <div className="mt-2 max-h-[28rem] divide-y divide-subtle overflow-y-auto rounded-card border border-subtle">
          {files.map((f, i) => (
            <label
              key={f.name + i}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
                className="size-4 shrink-0 accent-[var(--color-accent-blue)]"
              />
              <span className="min-w-0 flex-1 truncate text-ink" title={f.name}>
                {f.name}
              </span>
              <span className="shrink-0 text-xs text-ink-muted">{formatBytes(f.length)}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => closeReview()}
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-hover"
          >
            Cancel
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAdd}
            disabled={selected.size === 0 || submitting}
            className="rounded-full bg-accent-blue px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            {submitting ? "Adding…" : "Add torrent"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
