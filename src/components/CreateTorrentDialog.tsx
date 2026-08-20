import { Dialog } from "radix-ui";
import { useState } from "react";
import { IS_TAURI, createTorrentFile } from "../lib/tauri-bridge";
import { useSnackbarStore } from "../stores/snackbar";
import { useUiStore } from "../stores/ui";

const COMMON_PIECE_SIZES = [
  { label: "Auto", value: "" },
  { label: "256 KB", value: String(256 * 1024) },
  { label: "1 MB", value: String(1024 * 1024) },
  { label: "2 MB", value: String(2 * 1024 * 1024) },
  { label: "4 MB", value: String(4 * 1024 * 1024) },
  { label: "8 MB", value: String(8 * 1024 * 1024) },
];

export function CreateTorrentDialog() {
  const open = useUiStore((s) => s.createDialogOpen);
  const setOpen = useUiStore((s) => s.setCreateDialogOpen);
  const pushSnackbar = useSnackbarStore((s) => s.push);

  const [sourcePath, setSourcePath] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [name, setName] = useState("");
  const [trackers, setTrackers] = useState("");
  const [pieceLength, setPieceLength] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ infoHash: string; magnet: string } | null>(null);

  function reset() {
    setSourcePath("");
    setOutputPath("");
    setName("");
    setTrackers("");
    setPieceLength("");
    setSubmitting(false);
    setResult(null);
  }

  async function pickSource(directory: boolean) {
    const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
    const picked = await openDialog({ directory, multiple: false });
    if (typeof picked === "string") {
      setSourcePath(picked);
      const base = picked.split(/[/\\]/).pop() ?? picked;
      if (!name) setName(base);
    }
  }

  async function pickOutput() {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const base = name.trim() || sourcePath.split(/[/\\]/).pop() || "torrent";
    const picked = await save({
      defaultPath: `${base}.torrent`,
      filters: [{ name: "Torrent file", extensions: ["torrent"] }],
    });
    if (picked) setOutputPath(picked);
  }

  async function handleCreate() {
    if (!sourcePath.trim() || !outputPath.trim()) return;
    setSubmitting(true);
    try {
      const res = await createTorrentFile({
        source_path: sourcePath.trim(),
        name: name.trim() || null,
        trackers: trackers
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
        piece_length: pieceLength ? Number(pieceLength) : null,
        output_path: outputPath.trim(),
      });
      setResult({ infoHash: res.info_hash, magnet: res.magnet });
      pushSnackbar(`Created ${res.output_path}`);
    } catch (e) {
      pushSnackbar(`Couldn't create torrent: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  const canCreate = sourcePath.trim().length > 0 && outputPath.trim().length > 0;

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
          {result ? (
            <>
              <Dialog.Title className="text-lg font-medium text-ink">Torrent created</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-muted">
                Saved to {outputPath}.
              </Dialog.Description>
              <div className="mt-4 space-y-2">
                <div>
                  <p className="text-xs text-ink-muted">Info hash</p>
                  <p className="break-all font-mono text-xs text-ink">{result.infoHash}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Magnet link</p>
                  <p className="break-all font-mono text-xs text-ink">{result.magnet}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-accent-blue px-5 py-2 text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <Dialog.Title className="text-lg font-medium text-ink">Create a torrent</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-muted">
                Pick a file or folder to include, then choose where to save the .torrent.
              </Dialog.Description>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-ink-muted">Source</p>
                  {IS_TAURI ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void pickSource(false)}
                        className="flex-1 rounded-full border border-subtle px-3 py-1.5 text-sm text-ink hover:bg-surface-hover"
                      >
                        Pick file…
                      </button>
                      <button
                        onClick={() => void pickSource(true)}
                        className="flex-1 rounded-full border border-subtle px-3 py-1.5 text-sm text-ink hover:bg-surface-hover"
                      >
                        Pick folder…
                      </button>
                    </div>
                  ) : (
                    <input
                      value={sourcePath}
                      onChange={(e) => setSourcePath(e.target.value)}
                      placeholder="/path/to/file-or-folder (on the server)"
                      className="w-full rounded-card border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-blue"
                    />
                  )}
                  {sourcePath && (
                    <p className="mt-1 truncate text-xs text-ink-muted" title={sourcePath}>
                      {sourcePath}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-ink-muted">Name (optional)</p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Defaults to the file/folder name"
                    className="w-full rounded-card border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-blue"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-ink-muted">Trackers (one per line, optional)</p>
                  <textarea
                    value={trackers}
                    onChange={(e) => setTrackers(e.target.value)}
                    rows={2}
                    placeholder="udp://tracker.example.org:80/announce"
                    className="w-full resize-none rounded-card border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-blue"
                  />
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-ink-muted">Piece size</p>
                  <select
                    value={pieceLength}
                    onChange={(e) => setPieceLength(e.target.value)}
                    className="w-full rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
                  >
                    {COMMON_PIECE_SIZES.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-ink-muted">Save as</p>
                  {IS_TAURI ? (
                    <button
                      onClick={() => void pickOutput()}
                      className="w-full rounded-full border border-subtle px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-hover"
                    >
                      {outputPath || "Choose where to save…"}
                    </button>
                  ) : (
                    <input
                      value={outputPath}
                      onChange={(e) => setOutputPath(e.target.value)}
                      placeholder="/path/to/output.torrent (on the server)"
                      className="w-full rounded-card border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent-blue"
                    />
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-hover">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleCreate}
                  disabled={!canCreate || submitting}
                  className="rounded-full bg-accent-blue px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
