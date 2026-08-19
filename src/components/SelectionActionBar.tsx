import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useSnackbarStore } from "../stores/snackbar";
import { useTorrentsStore } from "../stores/torrents";
import { useUiStore } from "../stores/ui";

export function SelectionActionBar() {
  const selectedIds = useUiStore((s) => s.selectedIds);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const pause = useTorrentsStore((s) => s.pause);
  const resume = useTorrentsStore((s) => s.resume);
  const remove = useTorrentsStore((s) => s.remove);
  const pushSnackbar = useSnackbarStore((s) => s.push);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const ids = Array.from(selectedIds);
  const count = ids.length;

  async function bulk(action: (id: string) => Promise<void>, doneMessage: string) {
    await Promise.allSettled(ids.map(action));
    pushSnackbar(doneMessage);
    clearSelection();
  }

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="absolute inset-x-0 top-0 z-30 flex h-16 items-center gap-3 bg-surface-elevated px-6 shadow-card"
        >
          <button
            onClick={clearSelection}
            className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-hover"
          >
            <span className="material-symbols-rounded text-[20px]">close</span>
          </button>
          <span className="text-sm font-medium text-ink">{count} selected</span>

          <div className="flex-1" />

          {!confirmingDelete ? (
            <>
              <button
                onClick={() => bulk((id) => resume(id), "Started selected torrents")}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-hover"
              >
                <span className="material-symbols-rounded text-[18px]">play_arrow</span>
                Start
              </button>
              <button
                onClick={() => bulk((id) => pause(id), "Paused selected torrents")}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-hover"
              >
                <span className="material-symbols-rounded text-[18px]">pause</span>
                Pause
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-accent-red hover:bg-accent-red/10"
              >
                <span className="material-symbols-rounded text-[18px]">delete</span>
                Delete
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-ink-muted">Delete files from disk too?</span>
              <button
                onClick={() => {
                  setConfirmingDelete(false);
                  void bulk((id) => remove(id, false), "Removed selected torrents");
                }}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-surface-hover"
              >
                Keep files
              </button>
              <button
                onClick={() => {
                  setConfirmingDelete(false);
                  void bulk((id) => remove(id, true), "Deleted selected torrents and files");
                }}
                className="rounded-full bg-accent-red px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Delete files
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-hover"
              >
                Cancel
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
