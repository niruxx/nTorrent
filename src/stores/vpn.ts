import { create } from "zustand";
import { getPortmapStatus, onPortmapStatus, refreshPortmap } from "../lib/tauri-bridge";
import type { PortMapStatus } from "../lib/types";

const HISTORY_LENGTH = 10;

interface VpnState {
  status: PortMapStatus | null;
  history: PortMapStatus[];
  refreshing: boolean;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
}

let unlisten: (() => void) | null = null;
let initPromise: Promise<void> | null = null;

export const useVpnStore = create<VpnState>((set, get) => ({
  status: null,
  history: [],
  refreshing: false,

  init: () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        set({ status: await getPortmapStatus() });
      } catch {
        // engine not ready yet; the event stream will catch us up
      }
      if (!unlisten) {
        unlisten = await onPortmapStatus((status) => {
          const history = [status, ...get().history].slice(0, HISTORY_LENGTH);
          set({ status, history, refreshing: false });
        });
      }
    })();
    return initPromise;
  },

  refresh: async () => {
    set({ refreshing: true });
    await refreshPortmap();
  },
}));
