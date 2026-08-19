import { useMemo } from "react";
import type { SpeedSample } from "../stores/torrents";

function buildPath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - (max > 0 ? (v / max) * height : 0);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function SpeedSparkline({
  samples,
  width = 320,
  height = 64,
}: {
  samples: SpeedSample[];
  width?: number;
  height?: number;
}) {
  const { downPath, upPath, areaPath } = useMemo(() => {
    const downs = samples.map((s) => s.down);
    const ups = samples.map((s) => s.up);
    const max = Math.max(0.05, ...downs, ...ups);
    const downPath = buildPath(downs, width, height, max);
    const upPath = buildPath(ups, width, height, max);
    const step = downs.length > 1 ? width / (downs.length - 1) : 0;
    const areaPath =
      downs.length > 0
        ? `${downPath} L${((downs.length - 1) * step).toFixed(1)},${height} L0,${height} Z`
        : "";
    return { downPath, upPath, areaPath, max };
  }, [samples, width, height]);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="speed-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent-blue)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-accent-blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill="url(#speed-fill)" stroke="none" />}
      {downPath && (
        <path
          d={downPath}
          fill="none"
          stroke="var(--color-accent-blue)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {upPath && (
        <path
          d={upPath}
          fill="none"
          stroke="var(--color-accent-green)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
      )}
      {samples.length === 0 && (
        <line x1={0} y1={height - 1} x2={width} y2={height - 1} className="stroke-subtle" strokeWidth={2} />
      )}
    </svg>
  );
}
