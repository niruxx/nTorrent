/// Builds an HTTP client for nTorrent's own outgoing calls (RSS feeds,
/// tracker favicons, etc — not torrent-protocol traffic, which librqbit
/// handles itself). Shared so `Settings.ignore_ssl_errors` is honored
/// everywhere consistently instead of only wherever someone remembered to
/// check it.
pub fn build_client(ignore_ssl_errors: bool) -> reqwest::Client {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(ignore_ssl_errors)
        .build()
        .unwrap_or_default()
}
