import { useEffect, useState } from "react";
import { getStoredToken, setStoredToken } from "../lib/auth-token";
import { Logo } from "./Logo";

async function checkToken(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/whoami", { headers: { Authorization: `Bearer ${token}` } });
    return res.ok;
  } catch {
    return false;
  }
}

export function WebUiLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setChecking(false);
      return;
    }
    checkToken(stored).then((ok) => {
      if (ok) onAuthenticated();
      else setChecking(false);
    });
  }, [onAuthenticated]);

  async function submit() {
    const trimmed = token.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    const ok = await checkToken(trimmed);
    setSubmitting(false);
    if (ok) {
      setStoredToken(trimmed);
      onAuthenticated();
    } else {
      setError("That token wasn't accepted.");
    }
  }

  if (checking) return null;

  return (
    <div className="flex h-screen items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <h1 className="text-lg font-medium text-ink">nTorrent Web UI</h1>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Enter the access token from Settings &rarr; Web UI on the desktop app.
        </p>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Access token"
          autoFocus
          className="mt-4 w-full rounded-full border border-subtle bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-accent-blue"
        />
        {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
        <button
          onClick={submit}
          disabled={!token.trim() || submitting}
          className="mt-4 w-full rounded-full bg-accent-blue py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          {submitting ? "Checking…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
