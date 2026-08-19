mod commands;
mod engine;
mod portmap;
mod rss;
mod scheduler;
mod settings;
mod state;
mod web_ui;

use std::sync::Arc;

use tauri::Manager;
use tokio::sync::broadcast;

use portmap::manager::PortMapManager;
use settings::SettingsStore;
use web_ui::WebUiHandle;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();

            let default_download_dir = handle
                .path()
                .download_dir()
                .or_else(|_| handle.path().app_data_dir())
                .expect("could not resolve a downloads directory")
                .join("nTorrent");

            let settings_path = handle
                .path()
                .app_config_dir()
                .expect("could not resolve app config directory")
                .join("settings.json");

            let (settings_store, api, portmap, web_ui, stats_tx) =
                tauri::async_runtime::block_on(async {
                    let settings_store = Arc::new(SettingsStore::load(settings_path).await);
                    let settings = settings_store.get().await;

                    let download_dir = settings
                        .download_dir
                        .as_ref()
                        .map(std::path::PathBuf::from)
                        .unwrap_or(default_download_dir);

                    let api =
                        engine::session::build_api(download_dir, settings.bind_interface.clone())
                            .await
                            .expect("failed to start torrent engine");

                    let internal_port = api.session().listen_addr().map(|a| a.port()).unwrap_or(0);
                    let portmap = Arc::new(PortMapManager::new(internal_port));
                    let web_ui = Arc::new(WebUiHandle::default());
                    let (stats_tx, _) = broadcast::channel(8);

                    if let Err(e) = commands::settings::apply_settings(
                        &api,
                        &settings_store,
                        &portmap,
                        &web_ui,
                        &stats_tx,
                        settings,
                    )
                    .await
                    {
                        tracing::warn!("failed to apply settings on launch: {e}");
                    }

                    (settings_store, api, portmap, web_ui, stats_tx)
                });

            engine::events::spawn_stats_broadcaster(handle.clone(), api.clone(), stats_tx.clone());
            scheduler::spawn(api.clone(), settings_store.clone());
            rss::spawn(api.clone(), settings_store.clone());
            portmap.clone().spawn(handle.clone());

            app.manage(state::AppState {
                api,
                portmap,
                settings: settings_store,
                web_ui,
                stats_tx,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::torrents::list_torrents,
            commands::torrents::get_torrent_details,
            commands::torrents::get_torrent_stats,
            commands::torrents::add_torrent,
            commands::torrents::pause_torrent,
            commands::torrents::resume_torrent,
            commands::torrents::remove_torrent,
            commands::torrents::set_file_priority,
            commands::torrents::get_torrent_trackers,
            commands::vpn::get_portmap_status,
            commands::vpn::refresh_portmap,
            commands::vpn::list_network_interfaces,
            commands::settings::get_settings,
            commands::settings::set_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
