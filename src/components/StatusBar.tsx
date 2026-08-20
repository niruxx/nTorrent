import { useEffect, useState } from "react";
import { formatBytes } from "../lib/format";
import { getDiskSpace } from "../lib/tauri-bridge";
import { useSettingsStore } from "../stores/settings";
import { useVpnStore } from "../stores/vpn";

const POLL_MS = 30000;

export function StatusBar() {
  const showFreeSpace = useSettingsStore((s) => s.settings.show_free_space_in_status_bar);
  const showExternalIp = useSettingsStore((s) => s.settings.show_external_ip_in_status_bar);
  const externalIp = useVpnStore((s) => s.status?.external_ip);
  const initVpn = useVpnStore((s) => s.init);
  const [availableBytes, setAvailableBytes] = useState<number | null>(null);

  useEffect(() => {
    if (!showExternalIp) return;
    void initVpn();
  }, [showExternalIp, initVpn]);

  useEffect(() => {
    if (!showFreeSpace) return;
    let cancelled = false;
    async function poll() {
      try {
        const info = await getDiskSpace();
        if (!cancelled) setAvailableBytes(info.available_bytes);
      } catch {
        // leave the last known value showing
      }
    }
    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showFreeSpace]);

  if (!showFreeSpace && !showExternalIp) return null;

  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-subtle px-6 text-xs text-ink-muted">
      {showFreeSpace && (
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-rounded text-[14px]">hard_drive</span>
          {availableBytes == null ? "—" : `${formatBytes(availableBytes)} free`}
        </span>
      )}
      {showExternalIp && (
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-rounded text-[14px]">public</span>
          {externalIp ? `External IP: ${externalIp}` : "External IP: —"}
        </span>
      )}
    </footer>
  );
}
