//! Serves the same React app the desktop window uses, embedded into the
//! binary at compile time from the Vite build output (`dist/`, produced by
//! `npm run build` — this must have run at least once before the Rust
//! crate compiles, or the web UI will 404 with a "not built" message).

use axum::body::Body;
use axum::http::{StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../dist"]
struct Assets;

pub async fn static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    if let Some(file) = Assets::get(path) {
        return serve(path, file.data.into_owned());
    }

    // SPA fallback: unknown paths (client-side routes) get index.html.
    match Assets::get("index.html") {
        Some(file) => serve("index.html", file.data.into_owned()),
        None => (
            StatusCode::NOT_FOUND,
            "Web UI assets not built. Run `npm run build` in the project root, \
             then rebuild the app, and try again.",
        )
            .into_response(),
    }
}

fn serve(path: &str, data: Vec<u8>) -> Response {
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    Response::builder()
        .header(header::CONTENT_TYPE, mime.as_ref())
        .body(Body::from(data))
        .unwrap()
        .into_response()
}
