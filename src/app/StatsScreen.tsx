import { useEffect, useState } from "react";
import { formatBytes, formatEta, formatSpeed } from "../lib/format";
import { getSessionStats } from "../lib/tauri-bridge";
import type { StatsResponse } from "../lib/types";
import { useT } from "../lib/useT";
import { useSettingsStore } from "../stores/settings";

const POLL_MS = 2000;

function shareRatio(uploaded: number, downloaded: number): number {
  if (downloaded <= 0) return uploaded > 0 ? Infinity : 0;
  return uploaded / downloaded;
}

function formatRatio(ratio: number, hideZero: boolean): string {
  if (!Number.isFinite(ratio)) return hideZero ? "" : "∞";
  if (ratio === 0 && hideZero) return "";
  return ratio.toFixed(2);
}

function formatMaybe(value: string, hideZero: boolean, isZero: boolean): string {
  return hideZero && isZero ? "—" : value;
}

export function StatsScreen() {
  const hideZero = useSettingsStore((s) => s.settings.hide_zero_values);
  const t = useT();
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const s = await getSessionStats();
        if (!cancelled) setStats(s);
      } catch {
        // keep showing the last known snapshot
      }
    }
    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="material-symbols-rounded animate-spin text-[28px] text-ink-muted">
          progress_activity
        </span>
      </div>
    );
  }

  const ratio = shareRatio(stats.alltime_uploaded_bytes, stats.alltime_downloaded_bytes);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6 pb-8">
      <div className="rounded-card bg-surface p-6 shadow-card">
        <h3 className="text-sm font-medium text-ink">{t("stats_live")}</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Download"
            value={formatMaybe(
              formatSpeed(stats.download_speed.mbps * 1024 * 1024),
              hideZero,
              stats.download_speed.mbps === 0,
            )}
          />
          <Stat
            label="Upload"
            value={formatMaybe(
              formatSpeed(stats.upload_speed.mbps * 1024 * 1024),
              hideZero,
              stats.upload_speed.mbps === 0,
            )}
          />
          <Stat label="Connected peers" value={String(stats.peers.live)} />
          <Stat label="Session uptime" value={formatEta(stats.uptime_seconds)} />
        </div>
      </div>

      <div className="rounded-card bg-surface p-6 shadow-card">
        <h3 className="text-sm font-medium text-ink">{t("stats_connected_peers")}</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Live" value={String(stats.peers.live)} />
          <Stat label="Connecting" value={String(stats.peers.connecting)} />
          <Stat label="Queued" value={String(stats.peers.queued)} />
          <Stat label="Seen (total)" value={String(stats.peers.seen)} />
          <Stat label="TCP" value={String(stats.peers.live_tcp)} />
          <Stat label="uTP" value={String(stats.peers.live_utp)} />
          <Stat label="Dead" value={String(stats.peers.dead)} />
          <Stat label="Piece steals" value={String(stats.peers.steals)} />
        </div>
      </div>

      <div className="rounded-card bg-surface p-6 shadow-card">
        <h3 className="text-sm font-medium text-ink">{t("stats_session")}</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t("stats_downloaded")} value={formatBytes(stats.counters.fetched_bytes)} />
          <Stat label={t("stats_uploaded")} value={formatBytes(stats.counters.uploaded_bytes)} />
          <Stat label="Blocked incoming" value={String(stats.counters.blocked_incoming)} />
          <Stat label="Blocked outgoing" value={String(stats.counters.blocked_outgoing)} />
        </div>
      </div>

      <div className="rounded-card bg-surface p-6 shadow-card">
        <h3 className="text-sm font-medium text-ink">{t("stats_alltime")}</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t("stats_downloaded")} value={formatBytes(stats.alltime_downloaded_bytes)} />
          <Stat label={t("stats_uploaded")} value={formatBytes(stats.alltime_uploaded_bytes)} />
          <Stat label={t("stats_share_ratio")} value={formatRatio(ratio, hideZero) || "—"} />
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Accumulated across restarts, checkpointed every 20s while the app runs.
        </p>
      </div>
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
