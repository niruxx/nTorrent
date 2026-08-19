import { getStoredToken } from "./auth-token";

type WsListener = (kind: string, payload: unknown) => void;

let socket: WebSocket | null = null;
const listeners = new Set<WsListener>();
let reconnectTimer: number | undefined;

function connect() {
  const token = getStoredToken();
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const ws = new WebSocket(`${proto}://${window.location.host}/api/ws${query}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as { kind: string; payload: unknown };
      for (const listener of listeners) listener(msg.kind, msg.payload);
    } catch {
      // ignore malformed frames
    }
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (listeners.size > 0) {
      reconnectTimer = window.setTimeout(connect, 2000);
    }
  };
  socket = ws;
}

/** Subscribes to the web UI's live event stream (torrent stats, VPN status). Lazily connects. */
export function subscribeWs(listener: WsListener): () => void {
  if (!socket) connect();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
    }
  };
}
