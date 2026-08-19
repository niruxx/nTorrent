//! Private Internet Access' port-forwarding API. Unlike NAT-PMP/UPnP this
//! isn't a standard protocol — it's PIA's own `getSignature` / `bindPort`
//! HTTPS calls against the connected VPN server's gateway. Requires a token
//! the user obtains from their PIA account (see Settings); we don't
//! implement PIA's separate username/password login flow here.

use std::net::IpAddr;
use std::time::Duration;

use anyhow::{Context, Result, bail};
use base64::Engine;
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct PiaConfig {
    pub gateway: IpAddr,
    pub token: String,
}

#[derive(Debug, Clone)]
pub struct PiaMapping {
    pub external_port: u16,
    pub payload: String,
    pub signature: String,
}

#[derive(Deserialize)]
struct SignatureResponse {
    status: String,
    payload: String,
    signature: String,
}

#[derive(Deserialize)]
struct PayloadContents {
    port: u16,
}

#[derive(Deserialize)]
struct BindResponse {
    status: String,
}

fn client() -> Result<reqwest::Client> {
    // PIA's per-server certificate is issued for their hostname, not the raw
    // gateway IP, and isn't in the system trust store. This call still
    // travels entirely inside the already-encrypted VPN tunnel, so relaxing
    // certificate validation here is defense-in-depth we're giving up, not
    // a shortcut around the tunnel's own security.
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_secs(10))
        .build()
        .context("failed to build PIA http client")
}

/// Fetches a signed port assignment and immediately binds it.
pub async fn obtain_port(config: &PiaConfig) -> Result<PiaMapping> {
    let http = client()?;

    let sig_url = format!("https://{}:19999/getSignature?token={}", config.gateway, config.token);
    let sig: SignatureResponse = http.get(sig_url).send().await?.json().await?;
    if sig.status != "OK" {
        bail!("PIA getSignature returned status {}", sig.status);
    }

    let decoded = base64::engine::general_purpose::STANDARD
        .decode(&sig.payload)
        .context("decode PIA payload")?;
    let payload: PayloadContents = serde_json::from_slice(&decoded).context("parse PIA payload")?;

    bind(&http, config, &sig.payload, &sig.signature).await?;

    Ok(PiaMapping {
        external_port: payload.port,
        payload: sig.payload,
        signature: sig.signature,
    })
}

/// Re-binds an already-obtained mapping. PIA requires this roughly every 15
/// minutes or the forwarded port is released.
pub async fn rebind(config: &PiaConfig, mapping: &PiaMapping) -> Result<()> {
    bind(&client()?, config, &mapping.payload, &mapping.signature).await
}

async fn bind(http: &reqwest::Client, config: &PiaConfig, payload: &str, signature: &str) -> Result<()> {
    let url = format!(
        "https://{}:19999/bindPort?payload={payload}&signature={signature}",
        config.gateway
    );
    let resp: BindResponse = http.get(url).send().await?.json().await?;
    if resp.status != "OK" {
        bail!("PIA bindPort returned status {}", resp.status);
    }
    Ok(())
}
