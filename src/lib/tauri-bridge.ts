import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getStoredToken, notifyUnauthorized } from "./auth-token";
import { subscribeWs } from "./ws-bridge";
import type {
  ApiAddTorrentResponse,
  NetworkInterfaceInfo,
  PortMapStatus,
  Settings,
  TorrentDetailsResponse,
  TorrentIdOrHash,
  TorrentListResponse,
  TorrentStats,
} from "./types";

export const IS_TAURI = isTauri();

export const TORRENT_STATS_EVENT = "torrent://stats";
export const PORTMAP_STATUS_EVENT = "vpn://portmap-status";

// --- HTTP transport (used when running as the web UI, i.e. in a plain browser) ---

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");

  const res = await fetch(`/api${path}`, { ...init, headers });

  if (res.status === 401) {
    notifyUnauthorized();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function idPath(id: TorrentIdOrHash): string {
  return encodeURIComponent(String(id));
}

// --- Torrents ---

export function listTorrents() {
  return IS_TAURI
    ? invoke<TorrentListResponse>("list_torrents")
    : http<TorrentListResponse>("/torrents");
}

export function getTorrentDetails(id: TorrentIdOrHash) {
  return IS_TAURI
    ? invoke<TorrentDetailsResponse>("get_torrent_details", { id })
    : http<TorrentDetailsResponse>(`/torrents/${idPath(id)}`);
}

export function getTorrentStats(id: TorrentIdOrHash) {
  return IS_TAURI
    ? invoke<TorrentStats>("get_torrent_stats", { id })
    : http<TorrentStats>(`/torrents/${idPath(id)}/stats`);
}

export interface AddTorrentOpts {
  paused?: boolean;
  /** Fetch metadata (name, file list) without starting the download — for the file picker preview. */
  listOnly?: boolean;
  /** Restrict the download to these file indices once the user confirms their selection. */
  onlyFiles?: number[];
}

// Tauri's invoke_handler auto-converts snake_case command args to camelCase;
// axum deserializes our request structs using their literal (snake_case)
// field names. Same options, two different key casings per transport.
function tauriAddArgs(opts: AddTorrentOpts) {
  return {
    paused: opts.paused ?? false,
    listOnly: opts.listOnly ?? false,
    onlyFiles: opts.onlyFiles ?? null,
  };
}
function httpAddFields(opts: AddTorrentOpts) {
  return {
    paused: opts.paused ?? false,
    list_only: opts.listOnly ?? false,
    only_files: opts.onlyFiles ?? null,
  };
}

export function addTorrentFromUri(uri: string, opts: AddTorrentOpts = {}) {
  return IS_TAURI
    ? invoke<ApiAddTorrentResponse>("add_torrent", {
        input: { kind: "Uri", uri },
        ...tauriAddArgs(opts),
      })
    : http<ApiAddTorrentResponse>("/torrents", {
        method: "POST",
        body: JSON.stringify({ kind: "Uri", uri, ...httpAddFields(opts) }),
      });
}

export function addTorrentFromBytes(bytes: Uint8Array, opts: AddTorrentOpts = {}) {
  const byteArray = Array.from(bytes);
  return IS_TAURI
    ? invoke<ApiAddTorrentResponse>("add_torrent", {
        input: { kind: "File", bytes: byteArray },
        ...tauriAddArgs(opts),
      })
    : http<ApiAddTorrentResponse>("/torrents", {
        method: "POST",
        body: JSON.stringify({ kind: "File", bytes: byteArray, ...httpAddFields(opts) }),
      });
}

/** Desktop-only: native drag-and-drop hands us a real filesystem path. */
export function addTorrentFromPath(path: string, opts: AddTorrentOpts = {}) {
  return invoke<ApiAddTorrentResponse>("add_torrent", {
    input: { kind: "Path", path },
    ...tauriAddArgs(opts),
  });
}

export function getTorrentTrackers(id: TorrentIdOrHash) {
  return IS_TAURI
    ? invoke<string[]>("get_torrent_trackers", { id })
    : http<string[]>(`/torrents/${idPath(id)}/trackers`);
}

export function pauseTorrent(id: TorrentIdOrHash) {
  return IS_TAURI
    ? invoke<void>("pause_torrent", { id })
    : http<void>(`/torrents/${idPath(id)}/pause`, { method: "POST" });
}

export function resumeTorrent(id: TorrentIdOrHash) {
  return IS_TAURI
    ? invoke<void>("resume_torrent", { id })
    : http<void>(`/torrents/${idPath(id)}/resume`, { method: "POST" });
}

export function removeTorrent(id: TorrentIdOrHash, deleteFiles: boolean) {
  return IS_TAURI
    ? invoke<void>("remove_torrent", { id, deleteFiles })
    : http<void>(`/torrents/${idPath(id)}?delete_files=${deleteFiles}`, { method: "DELETE" });
}

export function setFilePriority(id: TorrentIdOrHash, fileIndices: number[]) {
  return IS_TAURI
    ? invoke<void>("set_file_priority", { id, fileIndices })
    : http<void>(`/torrents/${idPath(id)}/files`, {
        method: "POST",
        body: JSON.stringify(fileIndices),
      });
}

export function onTorrentStats(
  callback: (payload: TorrentListResponse) => void,
): Promise<UnlistenFn> {
  if (IS_TAURI) {
    return listen<TorrentListResponse>(TORRENT_STATS_EVENT, (event) => callback(event.payload));
  }
  const unsubscribe = subscribeWs((kind, payload) => {
    if (kind === "torrent_stats") callback(payload as TorrentListResponse);
  });
  return Promise.resolve(unsubscribe);
}

// --- VPN / port mapping ---

export function getPortmapStatus() {
  return IS_TAURI
    ? invoke<PortMapStatus>("get_portmap_status")
    : http<PortMapStatus>("/vpn/status");
}

export function refreshPortmap() {
  return IS_TAURI
    ? invoke<void>("refresh_portmap")
    : http<void>("/vpn/refresh", { method: "POST" });
}

export function listNetworkInterfaces() {
  return IS_TAURI
    ? invoke<NetworkInterfaceInfo[]>("list_network_interfaces")
    : http<NetworkInterfaceInfo[]>("/network/interfaces");
}

export function onPortmapStatus(
  callback: (payload: PortMapStatus) => void,
): Promise<UnlistenFn> {
  if (IS_TAURI) {
    return listen<PortMapStatus>(PORTMAP_STATUS_EVENT, (event) => callback(event.payload));
  }
  const unsubscribe = subscribeWs((kind, payload) => {
    if (kind === "portmap_status") callback(payload as PortMapStatus);
  });
  return Promise.resolve(unsubscribe);
}

// --- Settings ---

export function getSettings() {
  return IS_TAURI ? invoke<Settings>("get_settings") : http<Settings>("/settings");
}

export function setSettings(settings: Settings) {
  return IS_TAURI
    ? invoke<void>("set_settings", { settings })
    : http<void>("/settings", { method: "PUT", body: JSON.stringify(settings) });
}

/** Whether this OS supports registering .torrent/magnet: associations at runtime (Windows, Linux). */
export function fileAssociationsSupported() {
  return IS_TAURI
    ? invoke<boolean>("file_associations_supported")
    : http<boolean>("/file-associations/supported");
}
