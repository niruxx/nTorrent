use std::sync::Arc;

use librqbit::Api;
use librqbit::api::TorrentListResponse;
use tokio::sync::broadcast;

use crate::portmap::manager::PortMapManager;
use crate::settings::SettingsStore;
use crate::web_ui::WebUiHandle;

pub struct AppState {
    pub api: Api,
    pub portmap: Arc<PortMapManager>,
    pub settings: Arc<SettingsStore>,
    pub web_ui: Arc<WebUiHandle>,
    pub stats_tx: broadcast::Sender<Arc<TorrentListResponse>>,
}
