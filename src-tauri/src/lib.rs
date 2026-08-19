mod commands;
mod engine;
mod file_assoc;
mod portmap;
mod rss;
mod scheduler;
mod settings;
mod state;
mod web_ui;

use std::sync::Arc;

use librqbit::Api;
use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;
use tokio::sync::broadcast;

use commands::torrents::AddTorrentInput;
use portmap::manager::PortMapManager;
use settings::SettingsStore;
use web_ui::WebUiHandle;

/// Adds a torrent handed to us by the OS (a `.torrent` file path from a file
/// association, or a `magnet:` link from the deep-link handler) — used for
/// both a cold start with such an argument and a second-instance launch
/// that got forwarded to the already-running app.
fn spawn_add_external(api: Api, settings_store: Arc<SettingsStore>, input: AddTorrentInput) {
    tauri::async_runtime::spawn(async move {
        let download_dir = settings_store.get().await.download_dir;
        let opts = commands::torrents::build_add_options(download_dir, false, false, None);
        match commands::torrents::resolve_add_torrent(input).await {
            Ok(add) => {
                if let Err(e) = api.api_add_torrent(add, Some(opts)).await {
                    tracing::warn!("failed to add torrent from OS association: {e:#}");
                }
            }
            Err(e) => tracing::warn!("failed to read torrent from OS association: {e}"),
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be the first plugin registered: a second launch (e.g. from
        // double-clicking a .torrent file while nTorrent is already open)
        // gets forwarded here and the new process exits immediately.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            if let Some(path) = file_assoc::extract_torrent_path(&args) {
                let state = app.state::<state::AppState>();
                spawn_add_external(
                    state.api.clone(),
                    state.settings.clone(),
                    AddTorrentInput::Path { path },
                );
            }
            // magnet: links in `args` are handled by the "deep-link" feature
            // of this plugin, which forwards them to the deep-link plugin's
            // on_open_url handler registered in setup() below.
        }))
        .plugin(tauri_plugin_deep_link::init())
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
                        &handle,
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

            // magnet: links — both a cold start with one on the command line
            // and a forwarded second-instance launch (see the single-instance
            // plugin above) surface here as a `deep-link://new-url` event.
            {
                let handle_for_urls = handle.clone();
                app.deep_link().on_open_url(move |event| {
                    let state = handle_for_urls.state::<state::AppState>();
                    for url in event.urls() {
                        spawn_add_external(
                            state.api.clone(),
                            state.settings.clone(),
                            AddTorrentInput::Uri { uri: url.to_string() },
                        );
                    }
                });
            }

            let cold_start_args: Vec<String> = std::env::args().collect();
            app.deep_link().handle_cli_arguments(cold_start_args.iter());
            if let Some(path) = file_assoc::extract_torrent_path(&cold_start_args) {
                let state = app.state::<state::AppState>();
                spawn_add_external(
                    state.api.clone(),
                    state.settings.clone(),
                    AddTorrentInput::Path { path },
                );
            }

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
            file_assoc::file_associations_supported,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
