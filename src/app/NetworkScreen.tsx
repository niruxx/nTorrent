import { motion } from "motion/react";
import { useEffect } from "react";
import { useVpnStore } from "../stores/vpn";
import type { PortMapMethod, PortMapStatus } from "../lib/types";

const METHOD_LABEL: Record<PortMapMethod, string> = {
  nat_pmp: "NAT-PMP",
  upnp: "UPnP",
  pia: "Private Internet Access",
};

function timeAgo(ms: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-2 rounded-full bg-surface-hover px-3 py-1 text-sm font-medium text-ink">
      <span className="relative flex size-2.5">
        {active && (
          <motion.span
            className="absolute inset-0 rounded-full bg-accent-green"
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span
          className={`relative size-2.5 rounded-full ${active ? "bg-accent-green" : "bg-ink-muted"}`}
        />
      </span>
      {active ? "Port forwarding active" : "No port mapping"}
    </span>
  );
}

function HistoryRow({ entry }: { entry: PortMapStatus }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={`size-1.5 rounded-full ${entry.active ? "bg-accent-green" : "bg-accent-red"}`}
        />
        <span className="text-ink">
          {entry.active
            ? `Mapped port ${entry.external_port} via ${entry.method ? METHOD_LABEL[entry.method] : "?"}`
            : (entry.last_error ?? "Mapping lost")}
        </span>
      </div>
      <span className="text-xs text-ink-muted">{timeAgo(entry.updated_at_ms)}</span>
    </div>
  );
}

export function NetworkScreen() {
  const status = useVpnStore((s) => s.status);
  const history = useVpnStore((s) => s.history);
  const refreshing = useVpnStore((s) => s.refreshing);
  const init = useVpnStore((s) => s.init);
  const refresh = useVpnStore((s) => s.refresh);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="mx-auto max-w-2xl pt-6">
      <div className="rounded-card bg-surface p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <StatusPill active={status?.active ?? false} />
            <p className="mt-3 text-3xl font-medium text-ink">
              {status?.external_port ?? "—"}
              {status?.external_ip && (
                <span className="ml-2 text-base font-normal text-ink-muted">
                  {status.external_ip}
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {status?.method
                ? `via ${METHOD_LABEL[status.method]}`
                : (status?.last_error ?? "Trying to map a port…")}
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover"
            title="Refresh"
          >
            <motion.span
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={
                refreshing ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0 }
              }
              className="material-symbols-rounded text-[22px]"
            >
              refresh
            </motion.span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-subtle pt-4 sm:grid-cols-4">
          <Field label="Internal port" value={String(status?.internal_port ?? "—")} />
          <Field label="Gateway" value={status?.gateway ?? "—"} />
          <Field
            label="Lease"
            value={status?.lease_secs ? `${Math.round(status.lease_secs / 60)}m` : "—"}
          />
          <Field label="Updated" value={status ? timeAgo(status.updated_at_ms) : "—"} />
        </div>
      </div>

      <div className="mt-6 rounded-card bg-surface p-6 shadow-card">
        <h3 className="text-sm font-medium text-ink">Recent activity</h3>
        <div className="mt-1 divide-y divide-subtle">
          {history.length === 0 && <p className="py-3 text-sm text-ink-muted">No activity yet.</p>}
          {history.map((entry, i) => (
            <HistoryRow key={entry.updated_at_ms + i} entry={entry} />
          ))}
        </div>
      </div>

      <p className="mt-4 px-1 text-xs text-ink-muted">
        nTorrent tries NAT-PMP/PCP first (works with VPN gateways like ProtonVPN's), then UPnP for
        plain home routers, then your configured provider adapter. Configure provider credentials
        in Settings.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-ink" title={value}>
        {value}
      </p>
    </div>
  );
}
