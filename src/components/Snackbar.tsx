import { AnimatePresence, motion } from "motion/react";
import { useSnackbarStore } from "../stores/snackbar";

export function Snackbar() {
  const messages = useSnackbarStore((s) => s.messages);
  const dismiss = useSnackbarStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
      <AnimatePresence>
        {messages.map((m) => (
          <motion.div
            key={m.id}
            layout
            initial={{ y: 24, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto flex items-center gap-4 rounded-full bg-[#323232] px-5 py-3 text-sm text-white shadow-overlay"
          >
            <span>{m.text}</span>
            {m.action && (
              <button
                onClick={() => {
                  m.action?.onClick();
                  dismiss(m.id);
                }}
                className="font-medium text-accent-blue hover:opacity-80"
              >
                {m.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(m.id)}
              className="grid size-6 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <span className="material-symbols-rounded text-[16px]">close</span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
