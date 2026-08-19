//! Minimal RFC 6886 (NAT-PMP) client. Covers the common VPN-provider case
//! (e.g. ProtonVPN, which speaks plain NAT-PMP against its tunnel gateway)
//! without needing the fuller RFC 6887 (PCP) framing.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;

use anyhow::{Context, Result, bail};
use tokio::net::UdpSocket;
use tokio::time::timeout;

const NATPMP_PORT: u16 = 5351;
const OP_EXTERNAL_ADDRESS: u8 = 0;
const OP_MAP_TCP: u8 = 2;
const MAX_ATTEMPTS: u32 = 4;
const INITIAL_TIMEOUT: Duration = Duration::from_millis(250);

pub struct NatPmpMapping {
    pub external_port: u16,
    pub lifetime: Duration,
}

pub async fn get_external_address(gateway: IpAddr) -> Result<IpAddr> {
    let resp = send_recv(gateway, &[0, OP_EXTERNAL_ADDRESS], 12).await?;
    check_result(&resp, OP_EXTERNAL_ADDRESS)?;
    let ip = Ipv4Addr::new(resp[8], resp[9], resp[10], resp[11]);
    Ok(IpAddr::V4(ip))
}

pub async fn map_tcp_port(gateway: IpAddr, internal_port: u16, lifetime_secs: u32) -> Result<NatPmpMapping> {
    let mut req = [0u8; 12];
    req[1] = OP_MAP_TCP;
    req[4..6].copy_from_slice(&internal_port.to_be_bytes());
    req[6..8].copy_from_slice(&internal_port.to_be_bytes());
    req[8..12].copy_from_slice(&lifetime_secs.to_be_bytes());

    let resp = send_recv(gateway, &req, 16).await?;
    check_result(&resp, OP_MAP_TCP)?;

    let external_port = u16::from_be_bytes([resp[10], resp[11]]);
    let lifetime = u32::from_be_bytes([resp[12], resp[13], resp[14], resp[15]]);

    Ok(NatPmpMapping {
        external_port,
        lifetime: Duration::from_secs(lifetime as u64),
    })
}

async fn send_recv(gateway: IpAddr, request: &[u8], expected_min_len: usize) -> Result<Vec<u8>> {
    let socket = UdpSocket::bind(("0.0.0.0", 0)).await.context("bind udp socket")?;
    let addr = SocketAddr::new(gateway, NATPMP_PORT);

    let mut delay = INITIAL_TIMEOUT;
    let mut last_err = anyhow::anyhow!("natpmp request failed");

    for _ in 0..MAX_ATTEMPTS {
        socket.send_to(request, addr).await.context("send natpmp request")?;
        let mut buf = [0u8; 16];
        match timeout(delay, socket.recv_from(&mut buf)).await {
            Ok(Ok((n, _))) if n >= expected_min_len => return Ok(buf[..n].to_vec()),
            Ok(Ok(_)) => last_err = anyhow::anyhow!("short natpmp response"),
            Ok(Err(e)) => last_err = e.into(),
            Err(_) => last_err = anyhow::anyhow!("natpmp request timed out"),
        }
        delay *= 2;
    }
    Err(last_err)
}

fn check_result(resp: &[u8], expected_op: u8) -> Result<()> {
    if resp.len() < 4 {
        bail!("natpmp response too short");
    }
    if resp[0] != 0 {
        bail!("unexpected natpmp version {}", resp[0]);
    }
    if resp[1] != expected_op | 0x80 {
        bail!("unexpected natpmp opcode {}", resp[1]);
    }
    let result_code = u16::from_be_bytes([resp[2], resp[3]]);
    if result_code != 0 {
        bail!("natpmp error result code {result_code}");
    }
    Ok(())
}
