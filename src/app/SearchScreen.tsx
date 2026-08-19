import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { IconButton, Section } from "../components/FormKit";
import { useSettingsStore } from "../stores/settings";
import type { SearchProvider } from "../lib/types";

function newId(): string {
  return crypto.randomUUID();
}

export function SearchScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [query, setQuery] = useState("");
  const [activeProviderId, setActiveProviderId] = useState<string | null>(
    settings.search_providers[0]?.id ?? null,
  );
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");

  function setProviders(providers: SearchProvider[]) {
    void update({ search_providers: providers });
  }

  function addProvider() {
    if (!newName.trim() || !newTemplate.includes("{query}")) return;
    const provider = { id: newId(), name: newName.trim(), url_template: newTemplate.trim() };
    setProviders([...settings.search_providers, provider]);
    setActiveProviderId(provider.id);
    setNewName("");
    setNewTemplate("");
  }

  function runSearch() {
    const provider = settings.search_providers.find((p) => p.id === activeProviderId);
    if (!provider || !query.trim()) return;
    const url = provider.url_template.replace("{query}", encodeURIComponent(query.trim()));
    void openUrl(url);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6 pb-8">
      <Section title="Search">
        {settings.search_providers.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Add a search provider below to search from here — nTorrent doesn't bundle any
            indexers itself.
          </p>
        ) : (
          <div className="flex gap-2">
            <select
              value={activeProviderId ?? ""}
              onChange={(e) => setActiveProviderId(e.target.value)}
              className="rounded-full border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none"
            >
              {settings.search_providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search…"
              className="flex-1 rounded-full border border-subtle bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-accent-blue"
            />
            <button
              onClick={runSearch}
              className="rounded-full bg-accent-blue px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Search
            </button>
          </div>
        )}
        <p className="text-xs text-ink-muted">
          Opens results in your browser. Copy magnet links from there and paste them into "Add
          torrent".
        </p>
      </Section>

      <Section title="Providers">
        {settings.search_providers.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{p.name}</p>
              <p className="truncate text-xs text-ink-muted" title={p.url_template}>
                {p.url_template}
              </p>
            </div>
            <IconButton
              icon="delete"
              danger
              onClick={() => setProviders(settings.search_providers.filter((x) => x.id !== p.id))}
            />
          </div>
        ))}
        <div className="space-y-2 border-t border-subtle pt-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Provider name"
            className="w-full rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
          <input
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
            placeholder="https://example.com/search?q={query}"
            className="w-full rounded-full border border-subtle bg-surface px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent-blue"
          />
          <button
            onClick={addProvider}
            disabled={!newName.trim() || !newTemplate.includes("{query}")}
            className="rounded-full bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            Add provider
          </button>
        </div>
      </Section>
    </div>
  );
}
