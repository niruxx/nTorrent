use std::collections::HashSet;

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use librqbit::api::{
    ApiAddTorrentResponse, ApiTorrentListOpts, EmptyJsonResponse, TorrentDetailsResponse,
    TorrentIdOrHash, TorrentListResponse,
};
use librqbit::TorrentStats;
use serde::{Deserialize, Serialize};

use crate::commands::create::{CreateTorrentRequest, CreateTorrentResponse};
use crate::commands::stats::StatsResponse;
use crate::commands::torrents::{AddTorrentInput, PeerInfo};
use crate::commands::vpn::NetworkInterfaceInfo;
use crate::portmap::PortMapStatus;
use crate::settings::Settings;

use super::WebState;

pub struct ApiErr(StatusCode, String);

impl IntoResponse for ApiErr {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({ "error": self.1 }))).into_response()
    }
}

fn bad_request(e: impl std::fmt::Display) -> ApiErr {
    ApiErr(StatusCode::BAD_REQUEST, e.to_string())
}

fn parse_id(id: &str) -> Result<TorrentIdOrHash, ApiErr> {
    TorrentIdOrHash::parse(id).map_err(bad_request)
}

pub async fn list_torrents(State(state): State<WebState>) -> Json<TorrentListResponse> {
    Json(state.api.api_torrent_list_ext(ApiTorrentListOpts { with_stats: true }))
}

pub async fn get_torrent_details(
    State(state): State<WebState>,
    Path(id): Path<String>,
) -> Result<Json<TorrentDetailsResponse>, ApiErr> {
    let id = parse_id(&id)?;
    state.api.api_torrent_details(id).map(Json).map_err(bad_request)
}

pub async fn get_torrent_stats(
    State(state): State<WebState>,
    Path(id): Path<String>,
) -> Result<Json<TorrentStats>, ApiErr> {
    let id = parse_id(&id)?;
    state.api.api_stats_v1(id).map(Json).map_err(bad_request)
}

#[derive(Deserialize)]
pub struct AddTorrentBody {
    #[serde(flatten)]
    pub input: AddTorrentInput,
    #[serde(default)]
    pub paused: bool,
    #[serde(default)]
    pub list_only: bool,
    #[serde(default)]
    pub only_files: Option<Vec<usize>>,
}

pub async fn add_torrent(
    State(state): State<WebState>,
    Json(body): Json<AddTorrentBody>,
) -> Result<Json<ApiAddTorrentResponse>, ApiErr> {
    crate::commands::torrents::add_torrent_impl(
        &state.api,
        &state.settings,
        body.input,
        body.paused,
        body.list_only,
        body.only_files,
    )
    .await
    .map(Json)
    .map_err(bad_request)
}

pub async fn get_torrent_trackers(
    State(state): State<WebState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<String>>, ApiErr> {
    let id = parse_id(&id)?;
    let handle = state.api.mgr_handle(id).map_err(bad_request)?;
    Ok(Json(handle.shared().trackers.iter().map(|u| u.to_string()).collect()))
}

pub async fn get_torrent_peers(
    State(state): State<WebState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<PeerInfo>>, ApiErr> {
    let id = parse_id(&id)?;
    crate::commands::torrents::get_torrent_peers_impl(&state.api, &state.settings, id)
        .await
        .map(Json)
        .map_err(bad_request)
}

#[derive(Deserialize)]
pub struct FaviconQuery {
    pub tracker_url: String,
}

pub async fn get_tracker_favicon(
    State(state): State<WebState>,
    Query(q): Query<FaviconQuery>,
) -> Result<Json<String>, ApiErr> {
    crate::commands::favicon::get_tracker_favicon_impl(&state.settings, q.tracker_url)
        .await
        .map(Json)
        .map_err(bad_request)
}

pub async fn get_disk_space(
    State(state): State<WebState>,
) -> Result<Json<crate::commands::system::DiskSpaceInfo>, ApiErr> {
    crate::commands::system::get_disk_space_impl(&state.settings).await.map(Json).map_err(bad_request)
}

pub async fn get_session_stats(State(state): State<WebState>) -> Json<StatsResponse> {
    let session = state.api.api_session_stats();
    let settings = state.settings.get().await;
    Json(StatsResponse {
        session,
        alltime_downloaded_bytes: settings.alltime_downloaded_bytes,
        alltime_uploaded_bytes: settings.alltime_uploaded_bytes,
    })
}

pub async fn create_torrent(
    State(_state): State<WebState>,
    Json(req): Json<CreateTorrentRequest>,
) -> Result<Json<CreateTorrentResponse>, ApiErr> {
    crate::commands::create::create_torrent_impl(req).await.map(Json).map_err(bad_request)
}

pub async fn pause_torrent(
    State(state): State<WebState>,
    Path(id): Path<String>,
) -> Result<Json<EmptyJsonResponse>, ApiErr> {
    let id = parse_id(&id)?;
    state.api.api_torrent_action_pause(id).await.map(Json).map_err(bad_request)
}

pub async fn resume_torrent(
    State(state): State<WebState>,
    Path(id): Path<String>,
) -> Result<Json<EmptyJsonResponse>, ApiErr> {
    let id = parse_id(&id)?;
    state.api.api_torrent_action_start(id).await.map(Json).map_err(bad_request)
}

#[derive(Deserialize)]
pub struct RemoveQuery {
    #[serde(default)]
    pub delete_files: bool,
}

pub async fn remove_torrent(
    State(state): State<WebState>,
    Path(id): Path<String>,
    Query(q): Query<RemoveQuery>,
) -> Result<Json<EmptyJsonResponse>, ApiErr> {
    let id = parse_id(&id)?;
    let result = if q.delete_files {
        state.api.api_torrent_action_delete(id).await
    } else {
        state.api.api_torrent_action_forget(id).await
    };
    result.map(Json).map_err(bad_request)
}

pub async fn set_file_priority(
    State(state): State<WebState>,
    Path(id): Path<String>,
    Json(file_indices): Json<Vec<usize>>,
) -> Result<Json<EmptyJsonResponse>, ApiErr> {
    let id = parse_id(&id)?;
    let only_files: HashSet<usize> = file_indices.into_iter().collect();
    state
        .api
        .api_torrent_action_update_only_files(id, &only_files)
        .await
        .map(Json)
        .map_err(bad_request)
}

pub async fn get_portmap_status(State(state): State<WebState>) -> Json<PortMapStatus> {
    Json(state.portmap.current_status().await)
}

pub async fn refresh_portmap(State(state): State<WebState>) -> StatusCode {
    state.portmap.request_refresh();
    StatusCode::NO_CONTENT
}

pub async fn list_network_interfaces() -> Json<Vec<NetworkInterfaceInfo>> {
    Json(crate::commands::vpn::build_interface_list())
}

pub async fn file_associations_supported() -> Json<bool> {
    Json(crate::file_assoc::file_associations_supported())
}

pub async fn get_settings(State(state): State<WebState>) -> Json<Settings> {
    Json(state.settings.get().await)
}

pub async fn set_settings(
    State(state): State<WebState>,
    Json(settings): Json<Settings>,
) -> Result<StatusCode, ApiErr> {
    crate::commands::settings::apply_settings(
        &state.app,
        &state.api,
        &state.settings,
        &state.portmap,
        &state.web_ui,
        &state.stats_tx,
        settings,
    )
    .await
    .map(|_| StatusCode::NO_CONTENT)
    .map_err(|e| ApiErr(StatusCode::INTERNAL_SERVER_ERROR, e))
}

#[derive(Serialize)]
pub struct WhoAmI {
    pub web_ui: bool,
}

pub async fn whoami() -> Json<WhoAmI> {
    Json(WhoAmI { web_ui: true })
}
