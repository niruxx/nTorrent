export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="nTorrent"
    >
      <defs>
        <linearGradient id="nt-logo-grad" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6aa5ff" />
          <stop offset="100%" stopColor="#1a73e8" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#nt-logo-grad)" />
      {/* download arrow */}
      <path
        d="M24 11.5v16m0 0-6.5-6.5M24 27.5l6.5-6.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* peer swarm */}
      <circle cx="14.5" cy="35" r="2.3" fill="#ffffff" fillOpacity="0.85" />
      <circle cx="24" cy="37" r="2.7" fill="#ffffff" />
      <circle cx="33.5" cy="35" r="2.3" fill="#ffffff" fillOpacity="0.85" />
    </svg>
  );
}
