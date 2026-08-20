import { useEffect, useRef, useState } from "react";
import { formatBytes, formatSpeed } from "../lib/format";
import { getTorrentPeers } from "../lib/tauri-bridge";
import type { PeerInfo, TorrentIdOrHash } from "../lib/types";
import { useSettingsStore } from "../stores/settings";

const POLL_MS = 2000;

interface PeerRow extends PeerInfo {
  downSpeed: number;
  upSpeed: number;
}

export function PeersPanel({ id, active }: { id: TorrentIdOrHash; active: boolean }) {
  const hideZero = useSettingsStore((s) => s.settings.hide_zero_values);
  const [rows, setRows] = useState<PeerRow[] | null>(null);
  const prevRef = useRef<Map<string, { downloaded_bytes: number; uploaded_bytes: number; t: number }>>(
    new Map(),
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function poll() {
      try {
        const peers = await getTorrentPeers(id);
        if (cancelled) return;
        const now = Date.now();
        const prev = prevRef.current;
        const next = new Map<string, { downloaded_bytes: number; uploaded_bytes: number; t: number }>();
        const withSpeed: PeerRow[] = peers.map((p) => {
          const last = prev.get(p.addr);
          const dt = last ? Math.max(0.001, (now - last.t) / 1000) : 0;
          const downSpeed = last ? Math.max(0, (p.downloaded_bytes - last.downloaded_bytes) / dt) : 0;
          const upSpeed = last ? Math.max(0, (p.uploaded_bytes - last.uploaded_bytes) / dt) : 0;
          next.set(p.addr, { downloaded_bytes: p.downloaded_bytes, uploaded_bytes: p.uploaded_bytes, t: now });
          return { ...p, downSpeed, upSpeed };
        });
        prevRef.current = next;
        setRows(withSpeed);
      } catch {
        if (!cancelled) setRows([]);
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, active]);

  if (!active) return null;

  return (
    <div className="divide-y divide-subtle rounded-card border border-subtle">
      {rows === null && <p className="px-4 py-3 text-sm text-ink-muted">Loading peers…</p>}
      {rows?.length === 0 && (
        <p className="px-4 py-3 text-sm text-ink-muted">No connected peers right now.</p>
      )}
      {rows?.map((p) => (
        <div key={p.addr} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="material-symbols-rounded shrink-0 text-[16px] text-ink-muted">
            {p.conn_kind === "utp" ? "swap_horiz" : "lan"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs text-ink" title={p.addr}>
              {p.hostname ?? p.ip}
              <span className="text-ink-muted">:{p.port}</span>
            </p>
            {(p.client_name || (p.hostname && p.hostname !== p.ip)) && (
              <p
                className="truncate text-[11px] text-ink-muted"
                title={p.client_name ?? undefined}
              >
                {p.client_name}
                {p.client_name && p.hostname && p.hostname !== p.ip ? " · " : ""}
                {p.hostname && p.hostname !== p.ip ? p.ip : ""}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-ink-muted">
            {p.conn_kind ?? p.state}
          </span>
          <div className="flex w-36 shrink-0 flex-col items-end gap-0.5 text-[11px] text-ink-muted">
            {(!hideZero || p.downSpeed > 0) && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-rounded text-[12px]">arrow_downward</span>
                {formatSpeed(p.downSpeed)}
                <span className="text-ink-muted/70">({formatBytes(p.downloaded_bytes)})</span>
              </span>
            )}
            {(!hideZero || p.upSpeed > 0) && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-rounded text-[12px]">arrow_upward</span>
                {formatSpeed(p.upSpeed)}
                <span className="text-ink-muted/70">({formatBytes(p.uploaded_bytes)})</span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
