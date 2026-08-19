import type { Section } from "../stores/ui";
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
