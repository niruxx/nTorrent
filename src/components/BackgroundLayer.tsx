import { motion } from "motion/react";
import { useMemo } from "react";
import { useSettingsStore } from "../stores/settings";

function Snowfall() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        left: Math.random() * 100,
        size: 2 + Math.random() * 4,
        duration: 8 + Math.random() * 12,
        delay: -Math.random() * 20,
        drift: (Math.random() - 0.5) * 60,
        opacity: 0.25 + Math.random() * 0.5,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {flakes.map((f, i) => (
        <motion.span
          key={i}
          className="absolute top-[-5%] rounded-full bg-white"
          style={{ left: `${f.left}%`, width: f.size, height: f.size, opacity: f.opacity }}
          animate={{ y: ["0vh", "110vh"], x: [0, f.drift] }}
          transition={{ duration: f.duration, delay: f.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

/** A slow horizon of glowing ripples, evoking the PS3 XMB dashboard backdrop. */
function XmbWaves() {
  const waves = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        top: 20 + i * 15,
        duration: 14 + i * 3,
        delay: -i * 4,
        hue: 205 + i * 8,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#04070f]">
      {waves.map((w, i) => (
        <motion.div
          key={i}
          className="absolute left-[-20%] h-32 w-[140%] rounded-[100%] blur-2xl"
          style={{
            top: `${w.top}%`,
            background: `radial-gradient(ellipse at center, hsla(${w.hue}, 80%, 55%, 0.35), transparent 70%)`,
          }}
          animate={{ x: ["-5%", "5%", "-5%"], scaleY: [1, 1.3, 1] }}
          transition={{ duration: w.duration, delay: w.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function MinimalBreathing() {
  return (
    <motion.div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, var(--color-accent-blue) 10%, transparent), transparent)",
      }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function BackgroundLayer() {
  const mode = useSettingsStore((s) => s.settings.background_animation);

  if (mode === "none") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      {mode === "snowfall" && <Snowfall />}
      {mode === "xmb" && <XmbWaves />}
      {mode === "minimal" && <MinimalBreathing />}
    </div>
  );
}
