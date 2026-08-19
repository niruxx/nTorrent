import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { IS_TAURI } from "../lib/tauri-bridge";
import { Logo } from "./Logo";

// getCurrentWindow() reads Tauri's injected IPC metadata and throws when
// that's absent — which it always is outside the desktop webview (i.e. the
// web UI in a plain browser). Shell only renders <TitleBar> when IS_TAURI,
// but the module itself still gets evaluated on import regardless, so the
// call has to be guarded here too, not just at the render site.
const appWindow = IS_TAURI ? getCurrentWindow() : null;

function WindowButton({
  icon,
  onClick,
  danger,
  title,
}: {
  icon: string;
  onClick: () => void;
  danger?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`grid h-9 w-12 place-items-center text-ink-muted transition-colors ${
        danger ? "hover:bg-accent-red hover:text-white" : "hover:bg-surface-hover"
      }`}
    >
      <span className="material-symbols-rounded text-[16px]">{icon}</span>
    </button>
  );
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!appWindow) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    appWindow
      .isMaximized()
      .then((m) => !cancelled && setMaximized(m))
      .catch((e) => console.error("isMaximized failed", e));

    appWindow
      .onResized(() => {
        appWindow
          .isMaximized()
          .then((m) => !cancelled && setMaximized(m))
          .catch((e) => console.error("isMaximized failed", e));
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch((e) => console.error("onResized failed", e));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  if (!appWindow) return null;

  return (
    <header
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center justify-between border-b border-subtle bg-surface-sidebar select-none"
    >
      <div data-tauri-drag-region className="flex h-full flex-1 items-center px-3">
        <Logo size={18} />
      </div>
      <div className="flex h-full shrink-0 items-center">
        <WindowButton
          icon="remove"
          title="Minimize"
          onClick={() => appWindow.minimize().catch((e) => console.error("minimize failed", e))}
        />
        <WindowButton
          icon={maximized ? "filter_none" : "crop_square"}
          title={maximized ? "Restore" : "Maximize"}
          onClick={() =>
            appWindow.toggleMaximize().catch((e) => console.error("toggleMaximize failed", e))
          }
        />
        <WindowButton
          icon="close"
          title="Close"
          danger
          onClick={() => appWindow.close().catch((e) => console.error("close failed", e))}
        />
      </div>
    </header>
  );
}
