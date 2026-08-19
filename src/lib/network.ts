import type { NetworkInterfaceInfo } from "./types";

export function interfaceLabel(iface: NetworkInterfaceInfo): string {
  const base = iface.friendly_name ?? iface.description ?? iface.name;
  const hint = iface.vpn_hint ? ` (${iface.vpn_hint})` : "";
  const ip = iface.ipv4[0] ? ` — ${iface.ipv4[0]}` : "";
  return `${base}${hint}${ip}`;
}
