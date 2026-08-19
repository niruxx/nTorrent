export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className="material-symbols-rounded text-[56px] text-ink-muted/60">{icon}</span>
      <div>
        <p className="text-base font-medium text-ink">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
