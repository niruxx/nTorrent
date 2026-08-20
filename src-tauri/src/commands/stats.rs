use tauri::State;

use crate::state::AppState;

/// Live session-wide stats from librqbit, plus our own persisted all-time
/// totals (librqbit's own counters reset to 0 every launch — see
/// `crate::stats::spawn`).
#[derive(serde::Serialize)]
pub struct StatsResponse {
    #[serde(flatten)]
    pub session: librqbit::session_stats::snapshot::SessionStatsSnapshot,
    pub alltime_downloaded_bytes: u64,
    pub alltime_uploaded_bytes: u64,
}

#[tauri::command]
pub async fn get_session_stats(state: State<'_, AppState>) -> Result<StatsResponse, String> {
    let session = state.api.api_session_stats();
    let settings = state.settings.get().await;
    Ok(StatsResponse {
        session,
        alltime_downloaded_bytes: settings.alltime_downloaded_bytes,
        alltime_uploaded_bytes: settings.alltime_uploaded_bytes,
    })
}
