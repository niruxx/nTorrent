import { useState } from "react";
import { IconButton, Row, Section, TextInput, ToggleSwitch } from "../components/FormKit";
import { useSettingsStore } from "../stores/settings";
import type { RssFeed, RssRule } from "../lib/types";

function newId(): string {
  return crypto.randomUUID();
}

export function RssScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [newPattern, setNewPattern] = useState("");

  function setFeeds(feeds: RssFeed[]) {
    void update({ rss_feeds: feeds });
  }
  function setRules(rules: RssRule[]) {
    void update({ rss_rules: rules });
  }

  function addFeed() {
    if (!newFeedUrl.trim()) return;
    setFeeds([...settings.rss_feeds, { id: newId(), url: newFeedUrl.trim(), enabled: true }]);
    setNewFeedUrl("");
  }

  function addRule() {
    if (!newPattern.trim()) return;
    setRules([
      ...settings.rss_rules,
      { id: newId(), feed_id: null, pattern: newPattern.trim(), enabled: true, paused_on_add: false },
    ]);
    setNewPattern("");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6 pb-8">
      <Section title="Feeds">
        {settings.rss_feeds.length === 0 && (
          <p className="text-sm text-ink-muted">No feeds added yet.</p>
        )}
        {settings.rss_feeds.map((feed) => (
          <div key={feed.id} className="flex items-center gap-3">
            <ToggleSwitch
              checked={feed.enabled}
              onChange={(v) =>
                setFeeds(settings.rss_feeds.map((f) => (f.id === feed.id ? { ...f, enabled: v } : f)))
              }
            />
            <span className="min-w-0 flex-1 truncate text-sm text-ink" title={feed.url}>
              {feed.url}
            </span>
            <IconButton
              icon="delete"
              danger
              onClick={() => setFeeds(settings.rss_feeds.filter((f) => f.id !== feed.id))}
            />
          </div>
        ))}
        <div className="flex gap-2 border-t border-subtle pt-4">
          <input
            value={newFeedUrl}
            onChange={(e) => setNewFeedUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFeed()}
            placeholder="https://example.com/feed.rss"
            className="flex-1 rounded-full border border-subtle bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-blue"
          />
          <button
            onClick={addFeed}
            className="rounded-full bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Add
          </button>
        </div>
      </Section>

      <Section title="Auto-download rules">
        {settings.rss_rules.length === 0 && (
          <p className="text-sm text-ink-muted">
            No rules yet — items matching a rule's pattern are added automatically.
          </p>
        )}
        {settings.rss_rules.map((rule) => (
          <div key={rule.id} className="space-y-2 border-b border-subtle pb-3 last:border-0 last:pb-0">
            <div className="flex items-center gap-2">
              <ToggleSwitch
                checked={rule.enabled}
                onChange={(v) =>
                  setRules(settings.rss_rules.map((r) => (r.id === rule.id ? { ...r, enabled: v } : r)))
                }
              />
              <input
                value={rule.pattern}
                onChange={(e) =>
                  setRules(
                    settings.rss_rules.map((r) =>
                      r.id === rule.id ? { ...r, pattern: e.target.value } : r,
                    ),
                  )
                }
                placeholder="regex, e.g. 1080p"
                className="flex-1 rounded-full border border-subtle bg-surface px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent-blue"
              />
              <IconButton
                icon="delete"
                danger
                onClick={() => setRules(settings.rss_rules.filter((r) => r.id !== rule.id))}
              />
            </div>
            <div className="flex items-center gap-3 pl-12 text-xs text-ink-muted">
              <select
                value={rule.feed_id ?? ""}
                onChange={(e) =>
                  setRules(
                    settings.rss_rules.map((r) =>
                      r.id === rule.id ? { ...r, feed_id: e.target.value || null } : r,
                    ),
                  )
                }
                className="rounded-full border border-subtle bg-surface px-2 py-1 text-ink outline-none"
              >
                <option value="">All feeds</option>
                {settings.rss_feeds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.url}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={rule.paused_on_add}
                  onChange={(e) =>
                    setRules(
                      settings.rss_rules.map((r) =>
                        r.id === rule.id ? { ...r, paused_on_add: e.target.checked } : r,
                      ),
                    )
                  }
                  className="size-3.5 accent-[var(--color-accent-blue)]"
                />
                Add paused
              </label>
            </div>
          </div>
        ))}
        <div className="flex gap-2 border-t border-subtle pt-4">
          <input
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            placeholder="New rule pattern (regex)"
            className="flex-1 rounded-full border border-subtle bg-surface px-3 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent-blue"
          />
          <button
            onClick={addRule}
            className="rounded-full bg-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Add rule
          </button>
        </div>
      </Section>

      <Section title="Polling">
        <Row label="Check every" hint="Minutes between feed checks">
          <TextInput
            type="number"
            value={settings.rss_poll_minutes}
            onChange={(e) => void update({ rss_poll_minutes: Number(e.target.value) || 15 })}
            className="w-24"
          />
        </Row>
      </Section>
    </div>
  );
}
