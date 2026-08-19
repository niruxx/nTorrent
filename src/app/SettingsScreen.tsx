import { useEffect, useState } from "react";
import { IconButton, Row, Section, TextInput, ToggleSwitch } from "../components/FormKit";
import { interfaceLabel } from "../lib/network";
import { fileAssociationsSupported, listNetworkInterfaces } from "../lib/tauri-bridge";
import { useSettingsStore } from "../stores/settings";
import type { NetworkInterfaceInfo, PortmapProvider, ScheduleRule, ThemeMode } from "../lib/types";

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
    .toString()
    .padStart(2, "0");
  const min = (m % 60).toString().padStart(2, "0");
  return `${h}:${min}`;
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function ScheduleEditor() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  function setRules(rules: ScheduleRule[]) {
    void update({ schedule: rules });
  }

  function addRule() {
    setRules([
      ...settings.schedule,
      { start_minute: 9 * 60, end_minute: 17 * 60, download_limit_kbps: 500, upload_limit_kbps: 100 },
    ]);
  }

  function updateRule(i: number, patch: Partial<ScheduleRule>) {
    setRules(settings.schedule.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRule(i: number) {
    setRules(settings.schedule.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <Row label="Enable schedule" hint="Apply different limits during set hours of the day">
        <ToggleSwitch
          checked={settings.schedule_enabled}
          onChange={(v) => void update({ schedule_enabled: v })}
        />
      </Row>

      {settings.schedule_enabled && (
        <div className="space-y-2 border-t border-subtle pt-3">
          {settings.schedule.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input
                type="time"
                value={minutesToTime(rule.start_minute)}
                onChange={(e) => updateRule(i, { start_minute: timeToMinutes(e.target.value) })}
                className="rounded-full border border-subtle bg-surface px-2 py-1 text-ink outline-none"
              />
              <span className="text-ink-muted">to</span>
              <input
                type="time"
                value={minutesToTime(rule.end_minute)}
                onChange={(e) => updateRule(i, { end_minute: timeToMinutes(e.target.value) })}
                className="rounded-full border border-subtle bg-surface px-2 py-1 text-ink outline-none"
              />
              <input
                type="number"
                placeholder="Down KB/s"
                value={rule.download_limit_kbps ?? ""}
                onChange={(e) =>
                  updateRule(i, {
                    download_limit_kbps: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-24 rounded-full border border-subtle bg-surface px-2 py-1 text-ink outline-none"
              />
              <input
                type="number"
                placeholder="Up KB/s"
                value={rule.upload_limit_kbps ?? ""}
                onChange={(e) =>
                  updateRule(i, {
                    upload_limit_kbps: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-24 rounded-full border border-subtle bg-surface px-2 py-1 text-ink outline-none"
              />
              <button
                onClick={() => removeRule(i)}
                className="grid size-7 place-items-center rounded-full text-ink-muted hover:bg-surface-hover hover:text-accent-red"
              >
                <span className="material-symbols-rounded text-[16px]">close</span>
              </button>
            </div>
          ))}
          <button
            onClick={addRule}
            className="mt-1 flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-accent-blue-dark hover:bg-accent-blue/10"
          >
            <span className="material-symbols-rounded text-[16px]">add</span>
            Add rule
          </button>
        </div>
      )}
    </div>
  );
}

function FileAssociationsSection() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    fileAssociationsSupported()
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);

  return (
    <Section title="File associations">
      <Row
        label="Open .torrent files and magnet links with nTorrent"
        hint={
          supported === false
            ? "Not available on this platform yet — set nTorrent as the default .torrent/magnet handler from your OS settings instead."
            : "Double-clicking a .torrent file or a magnet link will open and add it here."
        }
      >
        <ToggleSwitch
          checked={settings.file_associations_enabled}
          disabled={supported === false}
          onChange={(v) => void update({ file_associations_enabled: v })}
        />
      </Row>
    </Section>
  );
}

export function SettingsScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [downloadDir, setDownloadDir] = useState(settings.download_dir ?? "");
  const [piaGateway, setPiaGateway] = useState(settings.pia_gateway ?? "");
  const [piaToken, setPiaToken] = useState(settings.pia_token ?? "");
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);

  useEffect(() => setDownloadDir(settings.download_dir ?? ""), [settings.download_dir]);
  useEffect(() => setPiaGateway(settings.pia_gateway ?? ""), [settings.pia_gateway]);
  useEffect(() => setPiaToken(settings.pia_token ?? ""), [settings.pia_token]);
  useEffect(() => {
    listNetworkInterfaces()
      .then(setInterfaces)
      .catch(() => {});
  }, []);

  const vpnInterfaces = interfaces.filter((i) => i.vpn_hint);
  const otherInterfaces = interfaces.filter((i) => !i.vpn_hint);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6 pb-8">
      <Section title="Appearance">
        <Row label="Theme">
          <select
            value={settings.theme}
            onChange={(e) => void update({ theme: e.target.value as ThemeMode })}
            className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>
      </Section>

      <Section title="Downloads">
        <Row label="Download folder" hint="Leave blank to use your OS Downloads folder">
          <TextInput
            value={downloadDir}
            onChange={(e) => setDownloadDir(e.target.value)}
            onBlur={() => void update({ download_dir: downloadDir.trim() || null })}
            placeholder="Default"
          />
        </Row>
      </Section>

      <FileAssociationsSection />

      <Section title="Bandwidth">
        <Row label="Download limit" hint="KB/s, blank = unlimited">
          <input
            type="number"
            value={settings.download_limit_kbps ?? ""}
            onChange={(e) =>
              void update({
                download_limit_kbps: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="w-32 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
        </Row>
        <Row label="Upload limit" hint="KB/s, blank = unlimited">
          <input
            type="number"
            value={settings.upload_limit_kbps ?? ""}
            onChange={(e) =>
              void update({ upload_limit_kbps: e.target.value ? Number(e.target.value) : null })
            }
            className="w-32 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
        </Row>
        <ScheduleEditor />
      </Section>

      <Section title="Network & VPN">
        <Row
          label="Bind to network interface"
          hint="Forces all torrent traffic through this adapter (e.g. ProtonVPN's) — applies after restart"
        >
          <select
            value={settings.bind_interface ?? ""}
            onChange={(e) => void update({ bind_interface: e.target.value || null })}
            className="max-w-64 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            <option value="">Any (no binding)</option>
            {vpnInterfaces.length > 0 && (
              <optgroup label="Detected VPN adapters">
                {vpnInterfaces.map((iface) => (
                  <option key={iface.name} value={iface.name}>
                    {interfaceLabel(iface)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={vpnInterfaces.length > 0 ? "Other adapters" : "Adapters"}>
              {otherInterfaces.map((iface) => (
                <option key={iface.name} value={iface.name}>
                  {interfaceLabel(iface)}
                  {iface.has_gateway ? "" : " (no route)"}
                </option>
              ))}
            </optgroup>
          </select>
        </Row>
        {settings.bind_interface && !interfaces.some((i) => i.name === settings.bind_interface && i.vpn_hint) && (
          <p className="-mt-2 text-xs text-ink-muted">
            Tip: if you use ProtonVPN, look for the adapter tagged "ProtonVPN" or "WireGuard" above
            — that's usually the tunnel, not your regular network card.
          </p>
        )}
        <Row label="Port mapping" hint="Auto tries NAT-PMP/PCP then UPnP">
          <select
            value={settings.portmap_provider}
            onChange={(e) => void update({ portmap_provider: e.target.value as PortmapProvider })}
            className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            <option value="auto">Automatic</option>
            <option value="pia">Private Internet Access</option>
            <option value="off">Off</option>
          </select>
        </Row>

        {settings.portmap_provider === "pia" && (
          <>
            <Row label="PIA gateway IP" hint="The connected VPN server's gateway">
              <TextInput
                value={piaGateway}
                onChange={(e) => setPiaGateway(e.target.value)}
                onBlur={() => void update({ pia_gateway: piaGateway.trim() || null })}
                placeholder="10.x.x.1"
              />
            </Row>
            <Row label="PIA token" hint="From PIA's generateToken API">
              <TextInput
                type="password"
                value={piaToken}
                onChange={(e) => setPiaToken(e.target.value)}
                onBlur={() => void update({ pia_token: piaToken.trim() || null })}
                placeholder="Token"
              />
            </Row>
          </>
        )}

      </Section>

      <WebUiSection interfaces={interfaces} />
    </div>
  );
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function WebUiSection({ interfaces }: { interfaces: NetworkInterfaceInfo[] }) {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [revealToken, setRevealToken] = useState(false);
  const [copied, setCopied] = useState(false);

  function enable(v: boolean) {
    if (v && !settings.web_ui_token) {
      void update({ web_ui_enabled: true, web_ui_token: randomToken() });
    } else {
      void update({ web_ui_enabled: v });
    }
  }

  function regenerateToken() {
    void update({ web_ui_token: randomToken() });
  }

  function copyToken() {
    if (!settings.web_ui_token) return;
    void navigator.clipboard.writeText(settings.web_ui_token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const urls = [
    `http://localhost:${settings.web_ui_port}`,
    ...(settings.web_ui_bind_all
      ? interfaces
          .filter((i) => i.has_gateway && i.ipv4[0])
          .map((i) => `http://${i.ipv4[0]}:${settings.web_ui_port}`)
      : []),
  ];

  return (
    <Section title="Web UI">
      <Row
        label="Enable"
        hint="Serves this same UI over HTTP for remote management — off by default"
      >
        <ToggleSwitch checked={settings.web_ui_enabled} onChange={enable} />
      </Row>

      {settings.web_ui_enabled && (
        <>
          <Row label="Port">
            <input
              type="number"
              value={settings.web_ui_port}
              onChange={(e) => void update({ web_ui_port: Number(e.target.value) })}
              className="w-32 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
            />
          </Row>
          <Row
            label="Allow LAN access"
            hint="Off = only this computer. On = reachable from other devices on your network."
          >
            <ToggleSwitch
              checked={settings.web_ui_bind_all}
              onChange={(v) => void update({ web_ui_bind_all: v })}
            />
          </Row>

          <div>
            <p className="text-sm text-ink">Access token</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Required to sign in from a browser. Anyone with this token can fully manage your
              torrents.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                type={revealToken ? "text" : "password"}
                value={settings.web_ui_token ?? ""}
                className="flex-1 rounded-full border border-subtle bg-surface px-3 py-1.5 font-mono text-xs text-ink outline-none"
              />
              <IconButton
                icon={revealToken ? "visibility_off" : "visibility"}
                onClick={() => setRevealToken((v) => !v)}
                title="Show/hide"
              />
              <IconButton icon={copied ? "check" : "content_copy"} onClick={copyToken} title="Copy" />
              <IconButton icon="refresh" onClick={regenerateToken} title="Regenerate" />
            </div>
          </div>

          <div>
            <p className="text-sm text-ink">Open from</p>
            <div className="mt-1 space-y-0.5">
              {urls.map((url) => (
                <p key={url} className="font-mono text-xs text-ink-muted">
                  {url}
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </Section>
  );
}
