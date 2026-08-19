use serde::Serialize;
use tauri::State;

use crate::portmap::PortMapStatus;
use crate::state::AppState;

#[tauri::command]
pub async fn get_portmap_status(state: State<'_, AppState>) -> Result<PortMapStatus, String> {
    Ok(state.portmap.current_status().await)
}

#[tauri::command]
pub fn refresh_portmap(state: State<AppState>) {
    state.portmap.request_refresh();
}

#[derive(Serialize)]
pub struct NetworkInterfaceInfo {
    pub name: String,
    pub friendly_name: Option<String>,
    pub description: Option<String>,
    pub ipv4: Vec<String>,
    pub has_gateway: bool,
    /// A guessed VPN provider/technology name if this looks like a VPN
    /// adapter (e.g. "ProtonVPN", "WireGuard"), so the interface picker can
    /// surface it instead of making the user hunt through raw OS device
    /// names. None if nothing matched — still perfectly usable, just not
    /// specially labeled.
    pub vpn_hint: Option<&'static str>,
}

/// Best-effort guess at what VPN (if any) an adapter belongs to, from its
/// name/description. Windows adapter names vary by driver, so this covers
/// both provider-branded names and the generic tunnel drivers several
/// providers build on (Wintun/WireGuard, TAP for OpenVPN).
fn detect_vpn_hint(fields: &[Option<&str>]) -> Option<&'static str> {
    let haystack = fields
        .iter()
        .flatten()
        .map(|s| s.to_lowercase())
        .collect::<Vec<_>>()
        .join(" ");

    const PATTERNS: &[(&str, &str)] = &[
        ("proton", "ProtonVPN"),
        ("nordlynx", "NordVPN"),
        ("nordvpn", "NordVPN"),
        ("mullvad", "Mullvad"),
        ("expressvpn", "ExpressVPN"),
        ("surfshark", "Surfshark"),
        ("private internet access", "Private Internet Access"),
        ("pia wireguard", "Private Internet Access"),
        ("windscribe", "Windscribe"),
        ("cyberghost", "CyberGhost"),
        ("ivpn", "IVPN"),
        ("wireguard", "WireGuard"),
        ("wintun", "WireGuard-based VPN"),
        ("tap-windows", "OpenVPN"),
        ("openvpn", "OpenVPN"),
    ];

    PATTERNS
        .iter()
        .find(|(pattern, _)| haystack.contains(pattern))
        .map(|(_, label)| *label)
}

/// Lists network interfaces so Settings can offer a VPN adapter picker
/// (bound via `bind_interface`) without the user needing to know the raw
/// OS device name ahead of time.
#[tauri::command]
pub fn list_network_interfaces() -> Vec<NetworkInterfaceInfo> {
    build_interface_list()
}

pub fn build_interface_list() -> Vec<NetworkInterfaceInfo> {
    default_net::get_interfaces()
        .into_iter()
        .map(|iface| {
            let vpn_hint = detect_vpn_hint(&[
                Some(iface.name.as_str()),
                iface.friendly_name.as_deref(),
                iface.description.as_deref(),
            ]);
            NetworkInterfaceInfo {
                name: iface.name,
                friendly_name: iface.friendly_name,
                description: iface.description,
                ipv4: iface.ipv4.iter().map(|n| n.addr.to_string()).collect(),
                has_gateway: iface.gateway.is_some(),
                vpn_hint,
            }
        })
        .collect()
}
