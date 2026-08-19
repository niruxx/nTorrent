use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::Result;
use tauri::{AppHandle, Emitter};
use tokio::sync::{Notify, RwLock, broadcast};

use super::{MappedPort, PortMapMethod, PortMapStatus, natpmp, pia, upnp};

pub const PORTMAP_STATUS_EVENT: &str = "vpn://portmap-status";

const MIN_RETRY: Duration = Duration::from_secs(20);
const MAX_RETRY: Duration = Duration::from_secs(120);
const NATPMP_LEASE_SECS: u32 = 120;

#[derive(Debug, Clone)]
pub struct PortMapConfig {
    pub internal_port: u16,
    pub enabled: bool,
    pub pia: Option<pia::PiaConfig>,
}

pub struct PortMapManager {
    status: Arc<RwLock<PortMapStatus>>,
    config: Arc<RwLock<PortMapConfig>>,
    kick: Arc<Notify>,
    status_tx: broadcast::Sender<PortMapStatus>,
}

impl PortMapManager {
    pub fn new(internal_port: u16) -> Self {
        let (status_tx, _) = broadcast::channel(8);
        Self {
            status: Arc::new(RwLock::new(PortMapStatus {
                internal_port,
                ..Default::default()
            })),
            config: Arc::new(RwLock::new(PortMapConfig {
                internal_port,
                enabled: true,
                pia: None,
            })),
            kick: Arc::new(Notify::new()),
            status_tx,
        }
    }

    /// For the web UI's WebSocket clients — mirrors the Tauri event.
    pub fn subscribe(&self) -> broadcast::Receiver<PortMapStatus> {
        self.status_tx.subscribe()
    }

    /// Used by Settings to push PIA credentials / provider choice into the
    /// running manager without restarting it.
    #[allow(dead_code)]
    pub fn status_handle(&self) -> Arc<RwLock<PortMapStatus>> {
        self.status.clone()
    }

    #[allow(dead_code)]
    pub fn config_handle(&self) -> Arc<RwLock<PortMapConfig>> {
        self.config.clone()
    }

    pub async fn current_status(&self) -> PortMapStatus {
        self.status.read().await.clone()
    }

    /// Wakes the manager loop immediately instead of waiting out its current sleep.
    pub fn request_refresh(&self) {
        self.kick.notify_one();
    }

    pub fn spawn(self: Arc<Self>, app: AppHandle) {
        tauri::async_runtime::spawn(async move {
            let mut pia_mapping: Option<pia::PiaMapping> = None;
            let mut retry_backoff = MIN_RETRY;

            loop {
                let cfg = self.config.read().await.clone();
                let sleep_for = match attempt(&cfg, &mut pia_mapping).await {
                    Ok((mapped, renew_after)) => {
                        retry_backoff = MIN_RETRY;
                        self.set_active(mapped).await;
                        renew_after
                    }
                    Err(e) => {
                        pia_mapping = None;
                        self.set_error(e.to_string()).await;
                        let this_wait = retry_backoff;
                        retry_backoff = (retry_backoff * 2).min(MAX_RETRY);
                        this_wait
                    }
                };
                let snapshot = self.current_status().await;
                let _ = app.emit(PORTMAP_STATUS_EVENT, &snapshot);
                let _ = self.status_tx.send(snapshot);

                tokio::select! {
                    _ = tokio::time::sleep(sleep_for) => {}
                    _ = self.kick.notified() => {}
                }
            }
        });
    }

    async fn set_active(&self, mapped: MappedPort) {
        let mut status = self.status.write().await;
        status.active = true;
        status.method = Some(mapped.method);
        status.external_port = Some(mapped.external_port);
        status.external_ip = mapped.external_ip.map(|ip| ip.to_string());
        status.gateway = mapped.gateway.map(|ip| ip.to_string());
        status.lease_secs = Some(mapped.lease.as_secs());
        status.last_error = None;
        status.updated_at_ms = now_ms();
    }

    async fn set_error(&self, error: String) {
        let mut status = self.status.write().await;
        status.active = false;
        status.method = None;
        status.external_port = None;
        status.last_error = Some(error);
        status.updated_at_ms = now_ms();
    }
}

async fn attempt(
    cfg: &PortMapConfig,
    pia_mapping: &mut Option<pia::PiaMapping>,
) -> Result<(MappedPort, Duration)> {
    if !cfg.enabled {
        anyhow::bail!("port mapping disabled in settings");
    }

    let iface = default_net::get_default_interface().map_err(|e| anyhow::anyhow!(e))?;
    let gateway_ip: Option<IpAddr> = iface.gateway.as_ref().map(|g| g.ip_addr);
    let local_ip: Option<IpAddr> = iface.ipv4.first().map(|net| IpAddr::V4(net.addr));

    if let Some(gateway) = gateway_ip {
        if let Ok(mapping) = natpmp::map_tcp_port(gateway, cfg.internal_port, NATPMP_LEASE_SECS).await {
            *pia_mapping = None;
            let external_ip = natpmp::get_external_address(gateway).await.ok();
            let renew_after = (mapping.lifetime / 2).max(Duration::from_secs(15));
            return Ok((
                MappedPort {
                    method: PortMapMethod::NatPmp,
                    external_port: mapping.external_port,
                    external_ip,
                    gateway: Some(gateway),
                    lease: mapping.lifetime,
                },
                renew_after,
            ));
        }
    }

    if let Some(local_ip) = local_ip {
        let local_addr = SocketAddr::new(local_ip, cfg.internal_port);
        if let Ok(mapping) = upnp::map_tcp_port(local_addr).await {
            *pia_mapping = None;
            let renew_after = (mapping.lease / 2).max(Duration::from_secs(30));
            return Ok((
                MappedPort {
                    method: PortMapMethod::Upnp,
                    external_port: mapping.external_port,
                    external_ip: mapping.external_ip,
                    gateway: gateway_ip,
                    lease: mapping.lease,
                },
                renew_after,
            ));
        }
    }

    if let Some(pia_cfg) = &cfg.pia {
        let mapping = match pia_mapping.as_ref() {
            Some(existing) => match pia::rebind(pia_cfg, existing).await {
                Ok(()) => existing.clone(),
                Err(_) => pia::obtain_port(pia_cfg).await?,
            },
            None => pia::obtain_port(pia_cfg).await?,
        };
        let external_port = mapping.external_port;
        *pia_mapping = Some(mapping);
        return Ok((
            MappedPort {
                method: PortMapMethod::Pia,
                external_port,
                external_ip: gateway_ip,
                gateway: gateway_ip,
                lease: Duration::from_secs(900),
            },
            Duration::from_secs(600),
        ));
    }

    anyhow::bail!("no port mapping method succeeded (NAT-PMP and UPnP failed, PIA not configured)")
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
