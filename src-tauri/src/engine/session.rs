use std::path::PathBuf;

use anyhow::{Context, Result};
use librqbit::{Api, ListenerOptions, Session, SessionOptions, SessionPersistenceConfig};

/// Starts the torrent session and wraps it in librqbit's `Api` facade, which
/// exposes every operation the UI needs via already-serializable types.
///
/// `bind_interface`, when set, forces all BT-TCP/BT-UDP/DHT/tracker/LSD
/// traffic through that network device (e.g. a VPN's tun/wg adapter) — the
/// VPN binding option in Settings. Changing it takes effect on next launch,
/// since librqbit binds the device once at session construction.
pub async fn build_api(download_dir: PathBuf, bind_interface: Option<String>) -> Result<Api> {
    std::fs::create_dir_all(&download_dir)
        .with_context(|| format!("failed to create download directory {download_dir:?}"))?;

    let opts = SessionOptions {
        persistence: Some(SessionPersistenceConfig::Json { folder: None }),
        bind_device_name: bind_interface,
        listen: Some(ListenerOptions {
            // Port forwarding (UPnP, NAT-PMP/PCP, provider APIs) is handled
            // entirely by our own `portmap` module instead, so it can report
            // unified status/events to the UI and so we don't have two
            // independent systems racing to map the same port.
            enable_upnp_port_forwarding: false,
            ..Default::default()
        }),
        ..Default::default()
    };

    let session = Session::new_with_opts(download_dir, opts)
        .await
        .context("failed to start torrent session")?;

    Ok(Api::new(session, None, None))
}
