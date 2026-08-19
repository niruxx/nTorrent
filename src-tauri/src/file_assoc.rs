//! Registers/unregisters nTorrent as the OS handler for `.torrent` files
//! and `magnet:` links, toggled from the "File associations" setting.
//!
//! On Windows both are written by hand, straight to `HKCU\Software\Classes`
//! (no admin rights needed). We deliberately don't use
//! `tauri-plugin-deep-link`'s own register/unregister for `magnet:` here:
//! its `unregister()` also tries to clean up a machine-wide (`HKLM`)
//! registration if one exists — which on a machine where some *other* app
//! already owns `magnet:` system-wide fails with an access-denied error (no
//! admin rights) and aborts before it ever reaches the `HKCU` key we
//! actually own, silently leaving our per-user override in place after the
//! toggle is switched off. Writing `HKCU` ourselves, and only ever touching
//! a key if it still points at us, sidesteps that entirely. The plugin is
//! still used for the `on_open_url` event / CLI-argument plumbing (see
//! `lib.rs`), just not for registration.

use tauri::AppHandle;

/// Whether this OS supports toggling associations at runtime (without
/// reinstalling/re-signing the app).
pub fn supported() -> bool {
    cfg!(any(target_os = "windows", target_os = "linux"))
}

#[tauri::command]
pub fn file_associations_supported() -> bool {
    supported()
}

/// Applied every time settings are saved, and once at launch, so the
/// registration self-heals if the exe moved (e.g. after an update).
pub fn apply(_app: &AppHandle, enabled: bool) {
    if let Err(e) = apply_magnet(enabled) {
        tracing::warn!("magnet: link association: {e}");
    }
    if let Err(e) = apply_torrent_extension(enabled) {
        tracing::warn!(".torrent file association: {e}");
    }
}

#[cfg(target_os = "windows")]
fn current_exe_display() -> anyhow::Result<String> {
    use anyhow::Context;
    let exe = std::env::current_exe().context("resolving current exe path")?;
    Ok(dunce::simplified(&exe).display().to_string())
}

#[cfg(target_os = "windows")]
fn apply_magnet(enabled: bool) -> anyhow::Result<()> {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    const CLASSES: &str = "Software\\Classes";

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (classes, _) = hkcu.create_subkey(CLASSES)?;

    if enabled {
        let exe = current_exe_display()?;

        let (key, _) = classes.create_subkey("magnet")?;
        key.set_value("", &"URL:Magnet Protocol")?;
        key.set_value("URL Protocol", &"")?;
        let (icon, _) = key.create_subkey("DefaultIcon")?;
        icon.set_value("", &format!("{exe},0"))?;
        let (cmd, _) = key.create_subkey("shell\\open\\command")?;
        cmd.set_value("", &format!("\"{exe}\" \"%1\""))?;
    } else if let Ok(cmd) = classes.open_subkey("magnet\\shell\\open\\command") {
        // Only remove it if it's still ours — leave a system-wide (HKLM)
        // handler from some other app, or another app's own HKCU override,
        // untouched.
        let current: String = cmd.get_value("").unwrap_or_default();
        if current.to_lowercase().contains("ntorrent.exe") {
            let _ = classes.delete_subkey_all("magnet");
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn apply_torrent_extension(enabled: bool) -> anyhow::Result<()> {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    const PROG_ID: &str = "nTorrent.torrent";
    const CLASSES: &str = "Software\\Classes";

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (classes, _) = hkcu.create_subkey(CLASSES)?;

    if enabled {
        let exe = current_exe_display()?;

        let (prog, _) = classes.create_subkey(PROG_ID)?;
        prog.set_value("", &"nTorrent Torrent File")?;
        let (icon, _) = prog.create_subkey("DefaultIcon")?;
        icon.set_value("", &format!("{exe},0"))?;
        let (cmd, _) = prog.create_subkey("shell\\open\\command")?;
        cmd.set_value("", &format!("\"{exe}\" \"%1\""))?;

        let (ext, _) = classes.create_subkey(".torrent")?;
        ext.set_value("", &PROG_ID)?;
    } else {
        // Only remove the .torrent -> ProgID pointer if it's still ours —
        // don't clobber another app the user may have re-associated to.
        if let Ok(ext) = classes.open_subkey(".torrent") {
            let current: String = ext.get_value("").unwrap_or_default();
            if current == PROG_ID {
                let _ = classes.delete_subkey_all(".torrent");
            }
        }
        let _ = classes.delete_subkey_all(PROG_ID);
    }
    Ok(())
}

/// Writes (or removes) a `~/.local/share/applications/*.desktop` entry and
/// points `xdg-mime` at it for `mime_type` — the standard per-user,
/// no-root-required way to register a MIME/URI handler on Linux. Shared by
/// the `.torrent` (`application/x-bittorrent`) and `magnet:`
/// (`x-scheme-handler/magnet`) registrations, which differ only in the mime
/// type and whether the app is invoked with a file path (`%f`) or URL (`%u`).
#[cfg(target_os = "linux")]
fn apply_linux_mime_handler(
    desktop_file_name: &str,
    mime_type: &str,
    arg_placeholder: &str,
    enabled: bool,
) -> anyhow::Result<()> {
    use std::fs;
    use std::process::Command;

    let apps_dir = linux_data_dir()?.join("applications");
    fs::create_dir_all(&apps_dir)?;
    let desktop_path = apps_dir.join(desktop_file_name);

    if enabled {
        let exe = std::env::current_exe()?;
        let contents = format!(
            "[Desktop Entry]\nType=Application\nName=nTorrent\nExec=\"{}\" {arg_placeholder}\nMimeType={mime_type};\nNoDisplay=true\n",
            exe.display(),
        );
        fs::write(&desktop_path, contents)?;

        let _ = Command::new("update-desktop-database").arg(&apps_dir).status();
        let _ = Command::new("xdg-mime")
            .args(["default", desktop_file_name, mime_type])
            .status();
    } else {
        let _ = fs::remove_file(&desktop_path);
        let _ = Command::new("update-desktop-database").arg(&apps_dir).status();
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn linux_data_dir() -> anyhow::Result<std::path::PathBuf> {
    if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
        if !xdg.is_empty() {
            return Ok(std::path::PathBuf::from(xdg));
        }
    }
    let home = std::env::var("HOME").map_err(|_| anyhow::anyhow!("HOME not set"))?;
    Ok(std::path::PathBuf::from(home).join(".local/share"))
}

#[cfg(target_os = "linux")]
fn apply_magnet(enabled: bool) -> anyhow::Result<()> {
    apply_linux_mime_handler(
        "ntorrent-magnet-handler.desktop",
        "x-scheme-handler/magnet",
        "%u",
        enabled,
    )
}

#[cfg(target_os = "linux")]
fn apply_torrent_extension(enabled: bool) -> anyhow::Result<()> {
    apply_linux_mime_handler(
        "ntorrent-torrent-handler.desktop",
        "application/x-bittorrent",
        "%f",
        enabled,
    )
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn apply_magnet(_enabled: bool) -> anyhow::Result<()> {
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn apply_torrent_extension(_enabled: bool) -> anyhow::Result<()> {
    Ok(())
}

/// If any of `args` (a process's CLI arguments) looks like a `.torrent`
/// file path handed to us by the OS file association, return it. Magnet
/// links arrive via `tauri-plugin-deep-link`'s CLI-argument handling
/// instead, not through here.
pub fn extract_torrent_path(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(".torrent"))
        .cloned()
}
