//! UPnP IGD client for plain home routers (not behind a VPN tunnel).

use std::net::{IpAddr, SocketAddr};
use std::time::Duration;

use anyhow::{Context, Result};
use igd_next::aio::tokio::search_gateway;
use igd_next::{PortMappingProtocol, SearchOptions};

const LEASE_SECS: u32 = 3600;

pub struct UpnpMapping {
    pub external_port: u16,
    pub external_ip: Option<IpAddr>,
    pub lease: Duration,
}

pub async fn map_tcp_port(local_addr: SocketAddr) -> Result<UpnpMapping> {
    let gateway = search_gateway(SearchOptions::default())
        .await
        .context("no UPnP gateway found")?;

    gateway
        .add_port(
            PortMappingProtocol::TCP,
            local_addr.port(),
            local_addr,
            LEASE_SECS,
            "nTorrent",
        )
        .await
        .context("UPnP AddPortMapping failed")?;

    let external_ip = gateway.get_external_ip().await.ok();

    Ok(UpnpMapping {
        external_port: local_addr.port(),
        external_ip,
        lease: Duration::from_secs(LEASE_SECS as u64),
    })
}
