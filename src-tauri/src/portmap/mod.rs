pub mod manager;
pub mod natpmp;
pub mod pia;
pub mod upnp;

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PortMapMethod {
    NatPmp,
    Upnp,
    Pia,
}

/// A successful mapping from one of the backends. Shared shape so the
/// manager doesn't need to know which backend produced it.
#[derive(Debug, Clone)]
pub struct MappedPort {
    pub method: PortMapMethod,
    pub external_port: u16,
    pub external_ip: Option<std::net::IpAddr>,
    pub gateway: Option<std::net::IpAddr>,
    pub lease: std::time::Duration,
}

/// What the frontend's Network screen renders. Kept flat and fully
/// serializable so it can travel as a Tauri event payload as-is.
#[derive(Debug, Clone, Serialize, Default)]
pub struct PortMapStatus {
    pub active: bool,
    pub method: Option<PortMapMethod>,
    pub internal_port: u16,
    pub external_port: Option<u16>,
    pub external_ip: Option<String>,
    pub gateway: Option<String>,
    pub lease_secs: Option<u64>,
    pub last_error: Option<String>,
    pub updated_at_ms: u64,
}
