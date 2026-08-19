import { Switch } from "radix-ui";
import type { ReactNode, InputHTMLAttributes } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card bg-surface p-6 shadow-card">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-sm text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onChange}
      className="relative h-6 w-10 rounded-full bg-subtle transition-colors data-[state=checked]:bg-accent-blue"
    >
      <Switch.Thumb className="block size-4 translate-x-1 rounded-full bg-white shadow-card transition-transform will-change-transform data-[state=checked]:translate-x-5" />
    </Switch.Root>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-56 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

export function IconButton({
  icon,
  onClick,
  danger,
  title,
}: {
  icon: string;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`grid size-7 place-items-center rounded-full text-ink-muted hover:bg-surface-hover ${danger ? "hover:text-accent-red" : ""}`}
    >
      <span className="material-symbols-rounded text-[16px]">{icon}</span>
    </button>
  );
}
