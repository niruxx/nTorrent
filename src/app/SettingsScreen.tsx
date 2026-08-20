import { useEffect, useState } from "react";
import { IconButton, Row, Section, TextInput, ToggleSwitch } from "../components/FormKit";
import { LANGUAGES } from "../lib/i18n";
import { interfaceLabel } from "../lib/network";
import { IS_TAURI, fileAssociationsSupported, listNetworkInterfaces } from "../lib/tauri-bridge";
import { useT } from "../lib/useT";
import { useSettingsStore } from "../stores/settings";
import type {
  ContentLayout,
  NetworkInterfaceInfo,
  PortmapProvider,
  ScheduleRule,
  Settings,
  ThemeMode,
  TorrentStopCondition,
} from "../lib/types";

async function pickFolder(defaultPath?: string): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, defaultPath: defaultPath || undefined });
  return typeof picked === "string" ? picked : null;
}

/**
 * A folder-path row: text input + onBlur commit, plus a native folder-picker
 * button on desktop (the web UI has no reliable way to hand back a real
 * server-side absolute path from a browser file dialog, so it stays
 * text-entry-only there).
 */
function PathRow({
  label,
  hint,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  async function browse() {
    const picked = await pickFolder(draft);
    if (picked) {
      setDraft(picked);
      onCommit(picked);
    }
  }

  return (
    <Row label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <TextInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommit(draft)}
          placeholder={placeholder}
        />
        {IS_TAURI && <IconButton icon="folder_open" title="Browse…" onClick={() => void browse()} />}
      </div>
    </Row>
  );
}

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
  const t = useT();

  useEffect(() => {
    fileAssociationsSupported()
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);

  return (
    <Section title={t("settings_file_associations")}>
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

function ProxySection() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [host, setHost] = useState(settings.proxy_host ?? "");
  const [port, setPort] = useState(settings.proxy_port?.toString() ?? "");
  const [username, setUsername] = useState(settings.proxy_username ?? "");
  const [password, setPassword] = useState(settings.proxy_password ?? "");

  useEffect(() => setHost(settings.proxy_host ?? ""), [settings.proxy_host]);
  useEffect(() => setPort(settings.proxy_port?.toString() ?? ""), [settings.proxy_port]);
  useEffect(() => setUsername(settings.proxy_username ?? ""), [settings.proxy_username]);
  useEffect(() => setPassword(settings.proxy_password ?? ""), [settings.proxy_password]);

  return (
    <Section title="Proxy server">
      <Row label="Enable proxy" hint="SOCKS5 only — applies to peer connections and tracker announces, after restart">
        <ToggleSwitch
          checked={settings.proxy_enabled}
          onChange={(v) => void update({ proxy_enabled: v })}
        />
      </Row>
      {settings.proxy_enabled && (
        <>
          <Row label="Host">
            <TextInput
              value={host}
              onChange={(e) => setHost(e.target.value)}
              onBlur={() => void update({ proxy_host: host.trim() || null })}
              placeholder="127.0.0.1"
            />
          </Row>
          <Row label="Port">
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              onBlur={() => void update({ proxy_port: port ? Number(port) : null })}
              className="w-28 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
            />
          </Row>
          <Row label="Username" hint="Optional">
            <TextInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => void update({ proxy_username: username.trim() || null })}
            />
          </Row>
          <Row label="Password" hint="Optional">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => void update({ proxy_password: password.trim() || null })}
            />
          </Row>
        </>
      )}
    </Section>
  );
}

function IpFilterSection() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [blocklist, setBlocklist] = useState(settings.ip_filter_blocklist_url ?? "");
  const [allowlist, setAllowlist] = useState(settings.ip_filter_allowlist_url ?? "");

  useEffect(() => setBlocklist(settings.ip_filter_blocklist_url ?? ""), [settings.ip_filter_blocklist_url]);
  useEffect(() => setAllowlist(settings.ip_filter_allowlist_url ?? ""), [settings.ip_filter_allowlist_url]);

  return (
    <Section title="IP filtering">
      <Row label="Enable IP filtering" hint="Loaded once at launch — applies after restart">
        <ToggleSwitch
          checked={settings.ip_filter_enabled}
          onChange={(v) => void update({ ip_filter_enabled: v })}
        />
      </Row>
      {settings.ip_filter_enabled && (
        <>
          <Row label="Blocklist URL" hint="http(s):// or file:// — PeerGuardian-style IP range list">
            <TextInput
              value={blocklist}
              onChange={(e) => setBlocklist(e.target.value)}
              onBlur={() => void update({ ip_filter_blocklist_url: blocklist.trim() || null })}
              placeholder="https://…"
            />
          </Row>
          <Row label="Allowlist URL" hint="Optional — only these IPs are allowed to connect if set">
            <TextInput
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              onBlur={() => void update({ ip_filter_allowlist_url: allowlist.trim() || null })}
              placeholder="https://…"
            />
          </Row>
          <Row
            label="Apply to trackers too"
            hint="Not distinguished by the engine — the blocklist only ever gates peer connections"
          >
            <ToggleSwitch
              checked={settings.ip_filter_apply_to_trackers}
              onChange={(v) => void update({ ip_filter_apply_to_trackers: v })}
            />
          </Row>
        </>
      )}
    </Section>
  );
}

export function SettingsScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const t = useT();
  const [piaGateway, setPiaGateway] = useState(settings.pia_gateway ?? "");
  const [piaToken, setPiaToken] = useState(settings.pia_token ?? "");
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);

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
      <Section title={t("settings_appearance")}>
        <Row label={t("settings_theme")}>
          <select
            value={settings.theme}
            onChange={(e) => void update({ theme: e.target.value as ThemeMode })}
            className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            <option value="system">{t("settings_theme_system")}</option>
            <option value="light">{t("settings_theme_light")}</option>
            <option value="dark">{t("settings_theme_dark")}</option>
          </select>
        </Row>
        <Row
          label={t("settings_background_animation")}
          hint={t("settings_background_animation_hint")}
        >
          <select
            value={settings.background_animation}
            onChange={(e) =>
              void update({ background_animation: e.target.value as Settings["background_animation"] })
            }
            className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            <option value="none">{t("settings_background_none")}</option>
            <option value="snowfall">{t("settings_background_snowfall")}</option>
            <option value="xmb">{t("settings_background_xmb")}</option>
            <option value="minimal">{t("settings_background_minimal")}</option>
          </select>
        </Row>
        <Row label={t("settings_language")}>
          <select
            value={settings.language}
            onChange={(e) => void update({ language: e.target.value })}
            className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title={t("settings_display")}>
        <Row label={t("settings_hide_zero")} hint={t("settings_hide_zero_hint")}>
          <ToggleSwitch
            checked={settings.hide_zero_values}
            onChange={(v) => void update({ hide_zero_values: v })}
          />
        </Row>
        <Row label="Show free disk space in status bar">
          <ToggleSwitch
            checked={settings.show_free_space_in_status_bar}
            onChange={(v) => void update({ show_free_space_in_status_bar: v })}
          />
        </Row>
        <Row label="Show external IP in status bar">
          <ToggleSwitch
            checked={settings.show_external_ip_in_status_bar}
            onChange={(v) => void update({ show_external_ip_in_status_bar: v })}
          />
        </Row>
      </Section>

      <Section title="Torrent content">
        <Row
          label="Content layout"
          hint="How multi-file torrents are laid out under the download folder — only takes effect when Download folder above is left blank"
        >
          <select
            value={settings.content_layout}
            onChange={(e) => void update({ content_layout: e.target.value as ContentLayout })}
            className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            <option value="original">Original</option>
            <option value="create_subfolder">Create subfolder</option>
            <option value="dont_create_subfolder">Don't create subfolder</option>
          </select>
        </Row>
        <Row label="Torrent stop condition" hint="Pause a newly added torrent automatically">
          <select
            value={settings.torrent_stop_condition}
            onChange={(e) =>
              void update({ torrent_stop_condition: e.target.value as TorrentStopCondition })
            }
            className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            <option value="none">None</option>
            <option value="metadata_received">Metadata received</option>
            <option value="files_checked">Files checked</option>
          </select>
        </Row>
        <Row
          label="Delete .torrent files afterwards"
          hint="Only applies when adding from a local .torrent file, not a magnet link"
        >
          <ToggleSwitch
            checked={settings.delete_torrent_file_after_add}
            onChange={(v) => void update({ delete_torrent_file_after_add: v })}
          />
        </Row>
        <Row
          label="Append .!qB extension to incomplete files"
          hint="Saved as a preference, but not enforced yet — needs deeper engine integration to do safely without risking in-progress downloads"
        >
          <ToggleSwitch
            checked={settings.append_incomplete_extension}
            onChange={(v) => void update({ append_incomplete_extension: v })}
          />
        </Row>
        <Row
          label="Keep unselected files in .unwanted folder"
          hint="Saved as a preference, but not enforced yet — same reason as the .!qB option above"
        >
          <ToggleSwitch
            checked={settings.keep_unselected_in_unwanted_folder}
            onChange={(v) => void update({ keep_unselected_in_unwanted_folder: v })}
          />
        </Row>
        <Row
          label="Enable recursive download dialog"
          hint="If a completed download contains .torrent files, prompt to add those too"
        >
          <ToggleSwitch
            checked={settings.recursive_download_dialog_enabled}
            onChange={(v) => void update({ recursive_download_dialog_enabled: v })}
          />
        </Row>
      </Section>

      <Section title={t("settings_downloads")}>
        <PathRow
          label="Download folder"
          hint="Leave blank to use your OS Downloads folder"
          value={settings.download_dir ?? ""}
          placeholder="Default"
          onCommit={(v) => void update({ download_dir: v.trim() || null })}
        />
        <PathRow
          label="Incomplete torrents path"
          hint="Saved as a preference, but not enforced yet — same reason as .!qB above"
          value={settings.incomplete_download_dir ?? ""}
          placeholder="Same as download folder"
          onCommit={(v) => void update({ incomplete_download_dir: v.trim() || null })}
        />
        <PathRow
          label="Copy .torrent files to"
          hint="Save a copy of every added .torrent file's bytes here"
          value={settings.copy_torrent_files_to ?? ""}
          placeholder="Disabled"
          onCommit={(v) => void update({ copy_torrent_files_to: v.trim() || null })}
        />
        <PathRow
          label="Watched folder"
          hint="Automatically add any .torrent file that appears here"
          value={settings.watched_folder ?? ""}
          placeholder="Disabled"
          onCommit={(v) => void update({ watched_folder: v.trim() || null })}
        />
      </Section>

      <FileAssociationsSection />

      <Section title={t("settings_bandwidth")}>
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
        <Row
          label="Apply to µTP protocol / transport overhead"
          hint="Not enforced yet — librqbit's rate limiter has no separate accounting for protocol overhead or per-transport (TCP vs µTP) limits"
        >
          <ToggleSwitch
            checked={settings.rate_limit_account_protocol_overhead}
            onChange={(v) => void update({ rate_limit_account_protocol_overhead: v })}
          />
        </Row>
        <Row
          label="Limit to peers on LAN"
          hint="Not enforced yet — librqbit's rate limiter has no LAN-peer exemption"
        >
          <ToggleSwitch
            checked={settings.rate_limit_exempt_lan_peers}
            onChange={(v) => void update({ rate_limit_exempt_lan_peers: v })}
          />
        </Row>
        <ScheduleEditor />
      </Section>

      <Section title="Connection">
        <Row label="Enable DHT" hint="Distributed peer discovery — applies after restart">
          <ToggleSwitch
            checked={settings.dht_enabled}
            onChange={(v) => void update({ dht_enabled: v })}
          />
        </Row>
        <Row
          label="Enable Peer Exchange (PeX)"
          hint="Not enforceable — librqbit always enables PeX for non-private torrents; there's no toggle in the engine"
        >
          <ToggleSwitch
            checked={settings.pex_enabled}
            onChange={(v) => void update({ pex_enabled: v })}
          />
        </Row>
        <Row
          label="Enable Local Peer Discovery"
          hint="LAN multicast peer announce — applies after restart"
        >
          <ToggleSwitch
            checked={settings.local_peer_discovery_enabled}
            onChange={(v) => void update({ local_peer_discovery_enabled: v })}
          />
        </Row>
      </Section>

      <ProxySection />
      <IpFilterSection />

      <Section title="Queueing & connections">
        <Row
          label="Enable multi-download"
          hint="Cap how many torrents can actively download at once — the rest queue and auto-resume as slots free up"
        >
          <input
            type="number"
            min={1}
            value={settings.max_active_downloads ?? ""}
            onChange={(e) =>
              void update({
                max_active_downloads: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="Unlimited"
            className="w-32 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
        </Row>
        <Row
          label="Maximum connections"
          hint="Peer connection limit applied to each torrent when it's added"
        >
          <input
            type="number"
            min={1}
            value={settings.global_max_connections ?? ""}
            onChange={(e) =>
              void update({
                global_max_connections: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="Unlimited"
            className="w-32 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
        </Row>
      </Section>

      <Section title={t("settings_network_vpn")}>
        <Row
          label="Listening port"
          hint="Incoming connection port for torrent traffic — applies after restart"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={65535}
              value={settings.listen_port ?? ""}
              onChange={(e) =>
                void update({ listen_port: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Automatic"
              className="w-28 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
            />
            <IconButton
              icon="casino"
              title="Random port"
              onClick={() => void update({ listen_port: 1024 + Math.floor(Math.random() * (65535 - 1024)) })}
            />
          </div>
        </Row>
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
        <Row
          label="UPnP / NAT-PMP port forwarding"
          hint="Automatic tries NAT-PMP/PCP then UPnP; Off disables port forwarding entirely"
        >
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
  const t = useT();
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
    <Section title={t("settings_web_ui")}>
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
