//! A minimal BEP3 (HTTP) BitTorrent tracker, so other clients on the LAN
//! (or internet, if port-forwarded) can announce to and discover peers
//! through this app — "Enable embedded tracker" in Advanced settings.
//! In-memory only: swarms don't survive a restart, matching what a
//! lightweight embedded tracker is actually for (LAN peer discovery, not a
//! public tracker replacement).

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Router;
use axum::extract::{ConnectInfo, RawQuery, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use librqbit_bencode::ByteBufOwned;
use percent_encoding::percent_decode_str;
use tokio::sync::Mutex;

use crate::settings::SettingsStore;

const STALE_AFTER: Duration = Duration::from_secs(30 * 60);
const CHECK_INTERVAL: Duration = Duration::from_secs(5);
const ANNOUNCE_INTERVAL_SECS: i64 = 1800;

#[derive(Clone, Copy)]
struct Peer {
    addr: SocketAddr,
    last_seen: Instant,
}

#[derive(Default)]
struct Swarms {
    // info_hash -> peer_id -> Peer
    by_info_hash: HashMap<Vec<u8>, HashMap<Vec<u8>, Peer>>,
}

type SharedSwarms = Arc<Mutex<Swarms>>;

pub fn spawn(settings: Arc<SettingsStore>) {
    tauri::async_runtime::spawn(async move {
        let swarms: SharedSwarms = Arc::new(Mutex::new(Swarms::default()));
        let mut running: Option<(tauri::async_runtime::JoinHandle<()>, u16)> = None;

        loop {
            let s = settings.get().await;
            let desired = s.enable_embedded_tracker.then_some(s.embedded_tracker_port);
            let running_port = running.as_ref().map(|(_, p)| *p);

            if desired != running_port {
                if let Some((handle, _)) = running.take() {
                    handle.abort();
                }
                if let Some(port) = desired {
                    match start_server(port, swarms.clone()).await {
                        Ok(handle) => {
                            tracing::info!("embedded tracker listening on :{port}");
                            running = Some((handle, port));
                        }
                        Err(e) => tracing::warn!("embedded tracker: failed to bind :{port}: {e}"),
                    }
                }
            }

            prune_stale(&swarms).await;
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

async fn prune_stale(swarms: &SharedSwarms) {
    let mut swarms = swarms.lock().await;
    for peers in swarms.by_info_hash.values_mut() {
        peers.retain(|_, p| p.last_seen.elapsed() < STALE_AFTER);
    }
    swarms.by_info_hash.retain(|_, peers| !peers.is_empty());
}

async fn start_server(
    port: u16,
    swarms: SharedSwarms,
) -> anyhow::Result<tauri::async_runtime::JoinHandle<()>> {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let router = Router::new().route("/announce", get(announce)).with_state(swarms);
    Ok(tauri::async_runtime::spawn(async move {
        if let Err(e) =
            axum::serve(listener, router.into_make_service_with_connect_info::<SocketAddr>()).await
        {
            tracing::warn!("embedded tracker server stopped: {e}");
        }
    }))
}

fn bencode_error(reason: &str) -> Response {
    #[derive(serde::Serialize)]
    struct Failure<'a> {
        #[serde(rename = "failure reason")]
        failure_reason: &'a str,
    }
    let mut buf = Vec::new();
    let _ = librqbit_bencode::bencode_serialize_to_writer(Failure { failure_reason: reason }, &mut buf);
    (StatusCode::BAD_REQUEST, buf).into_response()
}

/// BEP3 query params are raw 20-byte binary (`info_hash`, `peer_id`),
/// percent-encoded — not valid UTF-8 in general, so this parses the raw
/// query string by hand instead of using a typed `Query` extractor (which
/// would choke on non-UTF-8 decoded bytes).
async fn announce(
    State(swarms): State<SharedSwarms>,
    ConnectInfo(remote): ConnectInfo<SocketAddr>,
    RawQuery(query): RawQuery,
) -> Response {
    let Some(query) = query else { return bencode_error("missing query string") };

    let mut info_hash: Option<Vec<u8>> = None;
    let mut peer_id: Option<Vec<u8>> = None;
    let mut port: Option<u16> = None;
    let mut event: Option<String> = None;

    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else { continue };
        let decoded: Vec<u8> = percent_decode_str(value).collect();
        match key {
            "info_hash" => info_hash = Some(decoded),
            "peer_id" => peer_id = Some(decoded),
            "port" => port = String::from_utf8_lossy(&decoded).parse().ok(),
            "event" => event = Some(String::from_utf8_lossy(&decoded).into_owned()),
            _ => {}
        }
    }

    let (Some(info_hash), Some(peer_id), Some(port)) = (info_hash, peer_id, port) else {
        return bencode_error("missing info_hash, peer_id, or port");
    };
    if info_hash.len() != 20 || peer_id.len() != 20 {
        return bencode_error("info_hash/peer_id must be 20 bytes");
    }

    let peer_addr = SocketAddr::new(remote.ip(), port);
    let mut swarms = swarms.lock().await;
    let peers = swarms.by_info_hash.entry(info_hash.clone()).or_default();

    if event.as_deref() == Some("stopped") {
        peers.remove(&peer_id);
    } else {
        peers.insert(peer_id.clone(), Peer { addr: peer_addr, last_seen: Instant::now() });
    }

    // Compact peer format (BEP23): 6 bytes per peer (4 IPv4 + 2 port), for
    // everyone except the requester itself.
    let mut compact = Vec::new();
    for p in peers.values() {
        if p.addr == peer_addr {
            continue;
        }
        if let IpAddr::V4(ip) = p.addr.ip() {
            compact.extend_from_slice(&ip.octets());
            compact.extend_from_slice(&p.addr.port().to_be_bytes());
        }
    }
    let count = peers.len() as i64;
    drop(swarms);

    #[derive(serde::Serialize)]
    struct AnnounceResponse {
        interval: i64,
        #[serde(rename = "min interval")]
        min_interval: i64,
        complete: i64,
        incomplete: i64,
        peers: ByteBufOwned,
    }
    let body = AnnounceResponse {
        interval: ANNOUNCE_INTERVAL_SECS,
        min_interval: ANNOUNCE_INTERVAL_SECS / 2,
        complete: 0,
        incomplete: count.max(0),
        peers: ByteBufOwned::from(compact),
    };
    let mut buf = Vec::new();
    if librqbit_bencode::bencode_serialize_to_writer(body, &mut buf).is_err() {
        return bencode_error("internal error encoding response");
    }
    buf.into_response()
}
