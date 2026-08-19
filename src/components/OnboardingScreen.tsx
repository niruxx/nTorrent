import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { interfaceLabel } from "../lib/network";
import { listNetworkInterfaces } from "../lib/tauri-bridge";
import type { NetworkInterfaceInfo, ThemeMode } from "../lib/types";
import { useSettingsStore } from "../stores/settings";
import { Logo } from "./Logo";

const STEPS = ["welcome", "appearance", "downloads", "network", "done"] as const;
type Step = (typeof STEPS)[number];

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "system", label: "System", icon: "brightness_auto" },
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
];

export function OnboardingScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const update = useSettingsStore((s) => s.update);

  const [stepIndex, setStepIndex] = useState(0);
  const [downloadDir, setDownloadDir] = useState("");
  const [bindInterface, setBindInterface] = useState<string | null>(null);
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    listNetworkInterfaces()
      .then(setInterfaces)
      .catch(() => {});
  }, []);

  const step: Step = STEPS[stepIndex];

  function next() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function finish() {
    setFinishing(true);
    await update({
      onboarding_completed: true,
      download_dir: downloadDir.trim() || null,
      bind_interface: bindInterface,
    });
  }

  return (
    <div className="flex h-full items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-card bg-surface shadow-overlay">
        <div className="px-8 pt-8 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              {step === "welcome" && <WelcomeStep />}
              {step === "appearance" && (
                <AppearanceStep theme={settings.theme} onChange={setTheme} />
              )}
              {step === "downloads" && (
                <DownloadsStep value={downloadDir} onChange={setDownloadDir} />
              )}
              {step === "network" && (
                <NetworkStep
                  interfaces={interfaces}
                  value={bindInterface}
                  onChange={setBindInterface}
                />
              )}
              {step === "done" && <DoneStep />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 border-t border-subtle px-8 py-5">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`size-1.5 rounded-full transition-colors ${
                  i === stepIndex ? "bg-accent-blue" : "bg-subtle"
                }`}
              />
            ))}
          </div>
          <div className="flex-1" />
          {stepIndex > 0 && step !== "done" && (
            <button
              onClick={back}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-hover"
            >
              Back
            </button>
          )}
          {step !== "done" ? (
            <button
              onClick={next}
              className="rounded-full bg-accent-blue px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {step === "welcome" ? "Get started" : "Next"}
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={finishing}
              className="rounded-full bg-accent-blue px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {finishing ? "Finishing…" : "Start using nTorrent"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <Logo size={72} />
      <h1 className="mt-5 text-xl font-medium text-ink">Welcome to nTorrent</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        A fast, animated torrent client with VPN port mapping and interface binding built in.
        Let's get a few things set up before you start downloading.
      </p>
    </div>
  );
}

function AppearanceStep({
  theme,
  onChange,
}: {
  theme: ThemeMode;
  onChange: (t: ThemeMode) => void;
}) {
  return (
    <div>
      <StepHeading title="Appearance" subtitle="Pick a theme — you can change this later in Settings." />
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center gap-2 rounded-card border-2 py-4 text-sm font-medium transition-colors ${
              theme === opt.value
                ? "border-accent-blue bg-accent-blue/5 text-accent-blue-dark"
                : "border-subtle text-ink-muted hover:bg-surface-hover"
            }`}
          >
            <span className="material-symbols-rounded text-[22px]">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DownloadsStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <StepHeading
        title="Downloads"
        subtitle="Where should finished and in-progress downloads go?"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Default (your OS Downloads folder)"
        className="w-full rounded-full border border-subtle bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-accent-blue"
      />
      <p className="mt-2 text-xs text-ink-muted">Leave blank to use the default. You can change this anytime.</p>
    </div>
  );
}

function NetworkStep({
  interfaces,
  value,
  onChange,
}: {
  interfaces: NetworkInterfaceInfo[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const vpnInterfaces = interfaces.filter((i) => i.vpn_hint);
  const otherInterfaces = interfaces.filter((i) => !i.vpn_hint);

  return (
    <div>
      <StepHeading
        title="VPN binding"
        subtitle="Optional: force all torrent traffic through a specific adapter — like ProtonVPN's — so nothing leaks if it disconnects."
      />
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-full border border-subtle bg-surface px-4 py-2.5 text-sm text-ink outline-none"
      >
        <option value="">Don't bind — use the default network route</option>
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
            </option>
          ))}
        </optgroup>
      </select>
      <p className="mt-2 text-xs text-ink-muted">
        Using ProtonVPN? Look for the adapter tagged "ProtonVPN" or "WireGuard" above. Port
        mapping (NAT-PMP/UPnP) is on automatically — fine-tune both anytime in Settings.
      </p>
    </div>
  );
}

function DoneStep() {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-accent-green/12 text-accent-green">
        <span className="material-symbols-rounded text-[32px]">check</span>
      </div>
      <h2 className="mt-5 text-lg font-medium text-ink">You're all set</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Add a magnet link or a .torrent file to get started. Everything else — labels, RSS, the
        web UI — is in the sidebar whenever you need it.
      </p>
    </div>
  );
}
