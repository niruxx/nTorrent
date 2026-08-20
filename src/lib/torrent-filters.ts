import type { Section, SortMode } from "../stores/ui";
import type { TorrentDetailsResponse } from "./types";

export function isFinished(t: TorrentDetailsResponse): boolean {
  return t.stats?.finished ?? false;
}

export function isPaused(t: TorrentDetailsResponse): boolean {
  return t.stats?.state === "paused";
}

export function isDownloading(t: TorrentDetailsResponse): boolean {
  return t.stats?.state === "live" && !isFinished(t);
}

export function isSeeding(t: TorrentDetailsResponse): boolean {
  return t.stats?.state === "live" && isFinished(t);
}

export function isError(t: TorrentDetailsResponse): boolean {
  return t.stats?.state === "error";
}

export function matchesSection(t: TorrentDetailsResponse, section: Section): boolean {
  switch (section) {
    case "library":
      return true;
    case "downloading":
      return isDownloading(t);
    case "seeding":
      return isSeeding(t);
    case "completed":
      return isFinished(t);
    default:
      return true;
  }
}

export function matchesSearch(t: TorrentDetailsResponse, query: string): boolean {
  if (!query.trim()) return true;
  const name = (t.name ?? t.info_hash).toLowerCase();
  return name.includes(query.trim().toLowerCase());
}

export function progressPercent(t: TorrentDetailsResponse): number {
  const stats = t.stats;
  if (!stats || stats.total_bytes <= 0) return 0;
  return (stats.progress_bytes / stats.total_bytes) * 100;
}

/**
 * Sorts by the given mode; "custom" and "added" are no-ops here (custom
 * order is applied separately via `torrent_order` since it isn't a pure
 * function of the torrent's own data — see `TorrentGrid`).
 */
export function sortTorrents(
  torrents: TorrentDetailsResponse[],
  mode: SortMode,
): TorrentDetailsResponse[] {
  switch (mode) {
    case "name":
      return [...torrents].sort((a, b) =>
        (a.name ?? a.info_hash).localeCompare(b.name ?? b.info_hash),
      );
    case "size":
      return [...torrents].sort(
        (a, b) => (b.stats?.total_bytes ?? 0) - (a.stats?.total_bytes ?? 0),
      );
    case "progress":
      return [...torrents].sort((a, b) => progressPercent(b) - progressPercent(a));
    default:
      return torrents;
  }
}
