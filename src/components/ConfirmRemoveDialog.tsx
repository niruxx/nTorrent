import { AnimatePresence, motion } from "motion/react";
import { useT } from "../lib/useT";

export function ConfirmRemoveDialog({
  name,
  onCancel,
  onKeepFiles,
  onDeleteFiles,
}: {
  name: string;
  onCancel: () => void;
  onKeepFiles: () => void;
  onDeleteFiles: () => void;
}) {
  const t = useT();
  return (
    <AnimatePresence>
      <motion.div
        key="confirm-remove-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-card bg-surface-elevated p-5 shadow-overlay"
        >
          <h3 className="text-base font-medium text-ink">
            {t("confirm_remove_title")} <span className="font-normal text-ink-muted">"{name}"</span>
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            You can remove it from the list, or also delete the downloaded files from disk.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-hover"
            >
              {t("cancel")}
            </button>
            <button
              onClick={onKeepFiles}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink hover:bg-surface-hover"
            >
              {t("confirm_remove_keep_files")}
            </button>
            <button
              onClick={onDeleteFiles}
              className="rounded-full bg-accent-red px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {t("confirm_remove_delete_files")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
