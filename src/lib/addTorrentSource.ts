import type { AddTorrentOpts } from "./tauri-bridge";
import type { ApiAddTorrentResponse } from "./types";

export type AddTorrentSource =
  | { kind: "uri"; value: string }
  | { kind: "bytes"; value: File }
  | { kind: "path"; value: string };

export interface AddTorrentActions {
  addFromUri: (uri: string, opts?: AddTorrentOpts) => Promise<ApiAddTorrentResponse>;
  addFromBytes: (bytes: Uint8Array, opts?: AddTorrentOpts) => Promise<ApiAddTorrentResponse>;
  addFromPath: (path: string, opts?: AddTorrentOpts) => Promise<ApiAddTorrentResponse>;
}

export function runAddTorrent(
  actions: AddTorrentActions,
  source: AddTorrentSource,
  opts: AddTorrentOpts,
): Promise<ApiAddTorrentResponse> {
  switch (source.kind) {
    case "uri":
      return actions.addFromUri(source.value, opts);
    case "path":
      return actions.addFromPath(source.value, opts);
    case "bytes":
      return source.value
        .arrayBuffer()
        .then((buf) => actions.addFromBytes(new Uint8Array(buf), opts));
  }
}
