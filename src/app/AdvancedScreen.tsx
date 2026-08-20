import { useEffect, useState } from "react";
import { Row, Section, ToggleSwitch } from "../components/FormKit";
import { useSettingsStore } from "../stores/settings";
import type { ProcessMemoryPriority } from "../lib/types";

/** A textarea-backed list editor for the DHT bootstrap node list. */
function BootstrapNodesEditor() {
  const nodes = useSettingsStore((s) => s.settings.dht_bootstrap_nodes);
  const update = useSettingsStore((s) => s.update);
  const [draft, setDraft] = useState(nodes.join("\n"));

  useEffect(() => setDraft(nodes.join("\n")), [nodes]);

  function commit() {
    const next = draft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    void update({ dht_bootstrap_nodes: next });
  }

  return (
    <div>
      <p className="text-sm text-ink">DHT bootstrap nodes</p>
      <p className="mt-0.5 text-xs text-ink-muted">One host:port per line. Blank = librqbit's own defaults.</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={3}
        placeholder="dht.libtorrent.org:25401"
        className="mt-2 w-full resize-none rounded-card border border-subtle bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent-blue"
      />
    </div>
  );
}

export function AdvancedScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [filesizeLimit, setFilesizeLimit] = useState(settings.torrent_filesize_limit_mb?.toString() ?? "");
  const [embeddedPort, setEmbeddedPort] = useState(settings.embedded_tracker_port.toString());

  useEffect(
    () => setFilesizeLimit(settings.torrent_filesize_limit_mb?.toString() ?? ""),
    [settings.torrent_filesize_limit_mb],
  );
  useEffect(() => setEmbeddedPort(settings.embedded_tracker_port.toString()), [settings.embedded_tracker_port]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6 pb-8">
      <Section title="Verification & performance">
        <Row
          label="Torrent verification"
          hint="If enabled, active torrents are validated to ensure they downloaded completely and correctly. librqbit always hash-checks on add — this can't be disabled by the engine."
        >
          <ToggleSwitch
            checked={settings.torrent_verification_enabled}
            onChange={(v) => void update({ torrent_verification_enabled: v })}
          />
        </Row>
        <Row label="Process memory priority" hint="Windows only — takes effect immediately">
          <select
            value={settings.process_memory_priority}
            onChange={(e) =>
              void update({ process_memory_priority: e.target.value as ProcessMemoryPriority })
            }
            className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none"
          >
            <option value="normal">Normal</option>
            <option value="below_normal">Below normal</option>
            <option value="idle">Idle</option>
          </select>
        </Row>
        <Row label=".torrent filesize limit" hint="MB, blank = unlimited. Only applies to local files, not magnet links">
          <input
            type="number"
            min={0}
            value={filesizeLimit}
            onChange={(e) => setFilesizeLimit(e.target.value)}
            onBlur={() =>
              void update({ torrent_filesize_limit_mb: filesizeLimit ? Number(filesizeLimit) : null })
            }
            placeholder="Unlimited"
            className="w-32 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
        </Row>
        <Row
          label="Recheck torrents on completion"
          hint="Not enforced yet — librqbit has no force-recheck API"
        >
          <ToggleSwitch
            checked={settings.recheck_on_completion}
            onChange={(v) => void update({ recheck_on_completion: v })}
          />
        </Row>
        <Row label="Refresh interval" hint="How often the torrent list updates, in milliseconds">
          <input
            type="number"
            min={200}
            value={settings.refresh_interval_ms}
            onChange={(e) => void update({ refresh_interval_ms: Number(e.target.value) || 1500 })}
            className="w-32 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
        </Row>
      </Section>

      <Section title="Peers">
        <Row label="Resolve peer hostnames" hint="Reverse-DNS lookup shown in the Peers tab">
          <ToggleSwitch
            checked={settings.resolve_peer_hostnames}
            onChange={(v) => void update({ resolve_peer_hostnames: v })}
          />
        </Row>
        <Row
          label="Resolve peer countries"
          hint="Not enforced yet — would need a bundled GeoIP database or an external lookup service"
        >
          <ToggleSwitch
            checked={settings.resolve_peer_countries}
            onChange={(v) => void update({ resolve_peer_countries: v })}
          />
        </Row>
      </Section>

      <Section title="Confirmations">
        <Row label="Confirm removal of all tags">
          <ToggleSwitch
            checked={settings.confirm_removal_of_all_tags}
            onChange={(v) => void update({ confirm_removal_of_all_tags: v })}
          />
        </Row>
        <Row
          label="Confirm removal of a tracker from all torrents"
          hint="Not enforced yet — there's no bulk tracker-removal action in the app for this to gate"
        >
          <ToggleSwitch
            checked={settings.confirm_removal_of_tracker_from_all_torrents}
            onChange={(v) => void update({ confirm_removal_of_tracker_from_all_torrents: v })}
          />
        </Row>
      </Section>

      <Section title="Trackers">
        <Row
          label="Reannounce to all trackers when IP or port changes"
          hint="Not enforced yet — librqbit has no reannounce-now API"
        >
          <ToggleSwitch
            checked={settings.reannounce_on_ip_port_change}
            onChange={(v) => void update({ reannounce_on_ip_port_change: v })}
          />
        </Row>
        <Row label="Download tracker favicons" hint="Shown next to each tracker in the detail drawer">
          <ToggleSwitch
            checked={settings.download_tracker_favicon}
            onChange={(v) => void update({ download_tracker_favicon: v })}
          />
        </Row>
      </Section>

      <Section title="Display">
        <Row label="Enable speed graphs" hint="Shows the live speed sparkline in the detail drawer">
          <ToggleSwitch
            checked={settings.enable_speed_graphs}
            onChange={(v) => void update({ enable_speed_graphs: v })}
          />
        </Row>
      </Section>

      <Section title="Embedded tracker">
        <Row
          label="Enable embedded tracker"
          hint="Runs a minimal BEP3 HTTP tracker so other clients can announce to this app — takes a few seconds to start/stop after toggling"
        >
          <ToggleSwitch
            checked={settings.enable_embedded_tracker}
            onChange={(v) => void update({ enable_embedded_tracker: v })}
          />
        </Row>
        <Row label="Embedded tracker port">
          <input
            type="number"
            min={1}
            max={65535}
            value={embeddedPort}
            onChange={(e) => setEmbeddedPort(e.target.value)}
            onBlur={() => void update({ embedded_tracker_port: Number(embeddedPort) || 9000 })}
            className="w-28 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
        </Row>
        <Row
          label="Enable port forwarding for embedded tracker"
          hint="Not enforced yet — our port-mapping manager only maps the torrent listen port today"
        >
          <ToggleSwitch
            checked={settings.embedded_tracker_port_forwarding}
            onChange={(v) => void update({ embedded_tracker_port_forwarding: v })}
          />
        </Row>
      </Section>

      <Section title="File safety">
        <Row
          label="Enable Mark of the Web (MOTW) for downloaded files"
          hint="Windows only — tags completed files as internet-sourced, the same way a browser download would"
        >
          <ToggleSwitch
            checked={settings.enable_mark_of_the_web}
            onChange={(v) => void update({ enable_mark_of_the_web: v })}
          />
        </Row>
        <Row
          label="Ignore SSL errors"
          hint="Applies to nTorrent's own HTTPS calls (RSS, search, tracker favicons) — not torrent traffic"
        >
          <ToggleSwitch
            checked={settings.ignore_ssl_errors}
            onChange={(v) => void update({ ignore_ssl_errors: v })}
          />
        </Row>
      </Section>

      <Section title="DHT">
        <BootstrapNodesEditor />
      </Section>
    </div>
  );
}
