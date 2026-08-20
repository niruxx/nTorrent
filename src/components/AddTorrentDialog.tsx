import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { runAddTorrent, type AddTorrentSource } from "../lib/addTorrentSource";
import { IS_TAURI } from "../lib/tauri-bridge";
import { useTorrentsStore } from "../stores/torrents";
import { useUiStore } from "../stores/ui";

type Mode = "link" | "file";
type Step = "input" | "resolving";

export function AddTorrentDialog() {
  const open = useUiStore((s) => s.addDialogOpen);
  const setOpen = useUiStore((s) => s.setAddDialogOpen);
  const openReview = useUiStore((s) => s.openReview);
  const addFromUri = useTorrentsStore((s) => s.addFromUri);
  const addFromBytes = useTorrentsStore((s) => s.addFromBytes);
  const addFromPath = useTorrentsStore((s) => s.addFromPath);

  const [step, setStep] = useState<Step>("input");
  const [mode, setMode] = useState<Mode>("link");
  const [uri, setUri] = useState("");
  const [pausedOnAdd, setPausedOnAdd] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ label: string; source: File | string } | null>(
    null,
  );
  const [resolveError, setResolveError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open || !IS_TAURI) return;
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setDragActive(true);
      } else if (event.payload.type === "leave") {
        setDragActive(false);
      } else if (event.payload.type === "drop") {
        setDragActive(false);
        const path = event.payload.paths.find((p) => p.toLowerCase().endsWith(".torrent"));
        if (path) {
          setMode("file");
          setPendingFile({ label: path.split(/[/\\]/).pop() ?? path, source: path });
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [open]);

  function reset() {
    requestId.current += 1;
    setStep("input");
    setMode("link");
    setUri("");
    setPausedOnAdd(false);
    setPendingFile(null);
    setResolveError(null);
  }

  async function handleNext() {
    const source: AddTorrentSource | null =
      mode === "link"
        ? uri.trim()
          ? { kind: "uri", value: uri.trim() }
          : null
        : pendingFile
          ? typeof pendingFile.source === "string"
            ? { kind: "path", value: pendingFile.source }
            : { kind: "bytes", value: pendingFile.source }
          : null;
    if (!source) return;

    setResolveError(null);
    setStep("resolving");
    const myRequest = ++requestId.current;
    const actions = { addFromUri, addFromBytes, addFromPath };

    try {
      const result = await runAddTorrent(actions, source, { listOnly: true });
      if (myRequest !== requestId.current) return;
      setOpen(false);
      reset();
      openReview(source, result, pausedOnAdd);
    } catch (e) {
      if (myRequest !== requestId.current) return;
      setResolveError(String(e));
      setStep("input");
    }
  }

  const canGoNext = mode === "link" ? uri.trim().length > 0 : pendingFile !== null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="dialog-content fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface-elevated p-6 shadow-overlay outline-none">
          <Dialog.Title className="text-lg font-medium text-ink">Add torrent</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-muted">
            Paste a magnet link or add a .torrent file.
          </Dialog.Description>

          <div className="mt-4 flex gap-1 rounded-full bg-surface-hover p-1">
            <button
              onClick={() => setMode("link")}
              className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                mode === "link" ? "bg-surface-elevated text-ink shadow-card" : "text-ink-muted"
              }`}
            >
              Magnet / URL
            </button>
            <button
              onClick={() => setMode("file")}
              className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
                mode === "file" ? "bg-surface-elevated text-ink shadow-card" : "text-ink-muted"
              }`}
            >
              .torrent file
            </button>
          </div>

          <div className="mt-4">
            {mode === "link" ? (
              <textarea
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="magnet:?xt=urn:btih:..."
                rows={3}
                autoFocus
                disabled={step === "resolving"}
                className="w-full resize-none rounded-card border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-blue disabled:opacity-60"
              />
            ) : (
              <label
                onDragOver={(e) => {
                  if (IS_TAURI) return;
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => !IS_TAURI && setDragActive(false)}
                onDrop={(e) => {
                  if (IS_TAURI) return;
                  e.preventDefault();
                  setDragActive(false);
                  const file = Array.from(e.dataTransfer.files).find((f) =>
                    f.name.toLowerCase().endsWith(".torrent"),
                  );
                  if (file) setPendingFile({ label: file.name, source: file });
                }}
                className={`flex h-32 flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed text-center text-sm transition-colors ${
                  dragActive
                    ? "border-accent-blue bg-accent-blue/5 text-accent-blue-dark"
                    : "border-subtle text-ink-muted hover:bg-surface-hover"
                }`}
              >
                <span className="material-symbols-rounded text-[28px]">
                  {pendingFile ? "description" : "upload_file"}
                </span>
                {pendingFile ? pendingFile.label : "Drop a .torrent file, or click to browse"}
                <input
                  type="file"
                  accept=".torrent"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingFile({ label: file.name, source: file });
                  }}
                />
              </label>
            )}
          </div>

          {resolveError && (
            <p className="mt-3 text-sm text-accent-red">Couldn't read that torrent: {resolveError}</p>
          )}
          {step === "resolving" && (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
              <span className="material-symbols-rounded animate-spin text-[16px]">
                progress_activity
              </span>
              Reading file list… magnet links can take a moment.
            </p>
          )}

          <label className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={pausedOnAdd}
              onChange={(e) => setPausedOnAdd(e.target.checked)}
              className="size-4 accent-[var(--color-accent-blue)]"
            />
            Add paused
          </label>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-hover">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleNext}
              disabled={!canGoNext || step === "resolving"}
              className="rounded-full bg-accent-blue px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            >
              {step === "resolving" ? "Reading…" : "Next"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
