import { create } from "zustand";
import {
  addTorrentFromBytes,
  addTorrentFromPath,
  addTorrentFromUri,
  listTorrents,
  onTorrentStats,
  pauseTorrent,
  removeTorrent,
  resumeTorrent,
  setFilePriority,
  type AddTorrentOpts,
} from "../lib/tauri-bridge";
import type { ApiAddTorrentResponse, TorrentDetailsResponse, TorrentIdOrHash } from "../lib/types";

export interface SpeedSample {
  t: number;
  down: number;
  up: number;
}

const HISTORY_LENGTH = 60;

function torrentKey(t: TorrentDetailsResponse): string {
  return t.id != null ? String(t.id) : t.info_hash;
}

interface TorrentsState {
  torrents: TorrentDetailsResponse[];
  speedHistory: Record<string, SpeedSample[]>;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  addFromUri: (uri: string, opts?: AddTorrentOpts) => Promise<ApiAddTorrentResponse>;
  addFromBytes: (bytes: Uint8Array, opts?: AddTorrentOpts) => Promise<ApiAddTorrentResponse>;
  addFromPath: (path: string, opts?: AddTorrentOpts) => Promise<ApiAddTorrentResponse>;
  pause: (id: TorrentIdOrHash) => Promise<void>;
  resume: (id: TorrentIdOrHash) => Promise<void>;
  remove: (id: TorrentIdOrHash, deleteFiles: boolean) => Promise<void>;
  setFilePriority: (id: TorrentIdOrHash, fileIndices: number[]) => Promise<void>;
}

let unlisten: (() => void) | null = null;
let initPromise: Promise<void> | null = null;

export const useTorrentsStore = create<TorrentsState>((set, get) => ({
  torrents: [],
  speedHistory: {},
  loading: true,
  error: null,

  init: () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        const initial = await listTorrents();
        set({ torrents: initial.torrents, loading: false, error: null });
      } catch (e) {
        set({ error: String(e), loading: false });
      }
      if (!unlisten) {
        unlisten = await onTorrentStats((payload) => {
          const now = Date.now();
          const history = { ...get().speedHistory };
          for (const t of payload.torrents) {
            const key = torrentKey(t);
            const sample: SpeedSample = {
              t: now,
              down: t.stats?.live?.download_speed.mbps ?? 0,
              up: t.stats?.live?.upload_speed.mbps ?? 0,
            };
            const prev = history[key] ?? [];
            const next = [...prev, sample];
            if (next.length > HISTORY_LENGTH) next.shift();
            history[key] = next;
          }
          set({ torrents: payload.torrents, speedHistory: history });
        });
      }
    })();
    return initPromise;
  },

  addFromUri: (uri, opts) => addTorrentFromUri(uri, opts),
  addFromBytes: (bytes, opts) => addTorrentFromBytes(bytes, opts),
  addFromPath: (path, opts) => addTorrentFromPath(path, opts),
  pause: async (id) => {
    await pauseTorrent(id);
  },
  resume: async (id) => {
    await resumeTorrent(id);
  },
  remove: async (id, deleteFiles) => {
    await removeTorrent(id, deleteFiles);
  },
  setFilePriority: async (id, fileIndices) => {
    await setFilePriority(id, fileIndices);
  },
}));

export function disposeTorrentsStore() {
  unlisten?.();
  unlisten = null;
  initPromise = null;
}

export { torrentKey };
