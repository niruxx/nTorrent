use std::path::PathBuf;

use anyhow::{Context, Result};
use librqbit::{
    Api, ConnectionOptions, DhtSessionConfig, ListenerOptions, Session, SessionOptions,
    SessionPersistenceConfig,
};

use crate::settings::Settings;

/// Starts the torrent session and wraps it in librqbit's `Api` facade, which
/// exposes every operation the UI needs via already-serializable types.
///
/// A handful of settings only take effect here, at session construction —
/// librqbit has no live-reconfigure hooks for any of them, so changing
/// `bind_interface`, `listen_port`, `dht_*`, `local_peer_discovery_enabled`,
/// `proxy_*`, or `ip_filter_*` takes effect on next launch, not immediately.
pub async fn build_api(download_dir: PathBuf, settings: &Settings) -> Result<Api> {
    std::fs::create_dir_all(&download_dir)
        .with_context(|| format!("failed to create download directory {download_dir:?}"))?;

    let mut listen = ListenerOptions {
        // Port forwarding (UPnP, NAT-PMP/PCP, provider APIs) is handled
        // entirely by our own `portmap` module instead, so it can report
        // unified status/events to the UI and so we don't have two
        // independent systems racing to map the same port.
        enable_upnp_port_forwarding: false,
        ..Default::default()
    };
    if let Some(port) = settings.listen_port {
        listen.listen_addr.set_port(port);
    }

    let dht = settings.dht_enabled.then(|| DhtSessionConfig {
        bootstrap_addrs: (!settings.dht_bootstrap_nodes.is_empty())
            .then(|| settings.dht_bootstrap_nodes.clone()),
        ..Default::default()
    });

    let connect = settings
        .proxy_enabled
        .then(|| build_proxy_url(settings))
        .flatten()
        .map(|proxy_url| ConnectionOptions { proxy_url: Some(proxy_url), ..Default::default() });

    let opts = SessionOptions {
        persistence: Some(SessionPersistenceConfig::Json { folder: None }),
        bind_device_name: settings.bind_interface.clone(),
        listen: Some(listen),
        dht,
        disable_local_service_discovery: !settings.local_peer_discovery_enabled,
        connect,
        blocklist_url: settings
            .ip_filter_enabled
            .then(|| settings.ip_filter_blocklist_url.clone())
            .flatten(),
        allowlist_url: settings
            .ip_filter_enabled
            .then(|| settings.ip_filter_allowlist_url.clone())
            .flatten(),
        ..Default::default()
    };

    let session = Session::new_with_opts(download_dir, opts)
        .await
        .context("failed to start torrent session")?;

    Ok(Api::new(session, None, None))
}

/// Builds a `socks5://[user:pass@]host:port` URL from the individual proxy
/// fields — librqbit only takes the composed URL form.
fn build_proxy_url(settings: &Settings) -> Option<String> {
    let host = settings.proxy_host.as_deref()?;
    let port = settings.proxy_port?;
    let auth = match (&settings.proxy_username, &settings.proxy_password) {
        (Some(u), Some(p)) if !u.is_empty() => format!("{u}:{p}@"),
        _ => String::new(),
    };
    Some(format!("socks5://{auth}{host}:{port}"))
}
