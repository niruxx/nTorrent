use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

use chrono::{Local, Timelike};
use librqbit::Api;

use crate::settings::SettingsStore;

const CHECK_INTERVAL: Duration = Duration::from_secs(30);

pub fn spawn(api: Api, settings: Arc<SettingsStore>) {
    tauri::async_runtime::spawn(async move {
        loop {
            apply_current_limits(&api, &settings).await;
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

/// Recomputes and applies the effective bandwidth limits right now (base
/// limits, or a schedule rule's limits if one covers the current minute).
/// Called on a timer, and also immediately after Settings is saved so
/// changes take effect without waiting for the next tick.
pub async fn apply_current_limits(api: &Api, settings: &SettingsStore) {
    let s = settings.get().await;

    let (down_kbps, up_kbps) = if s.schedule_enabled {
        let now = Local::now().time();
        let now_minute = (now.hour() * 60 + now.minute()) as u16;
        s.schedule
            .iter()
            .find(|r| in_window(now_minute, r.start_minute, r.end_minute))
            .map(|r| (r.download_limit_kbps, r.upload_limit_kbps))
            .unwrap_or((s.download_limit_kbps, s.upload_limit_kbps))
    } else {
        (s.download_limit_kbps, s.upload_limit_kbps)
    };

    let session = api.session();
    session.ratelimits.set_download_bps(kbps_to_bps(down_kbps));
    session.ratelimits.set_upload_bps(kbps_to_bps(up_kbps));
}

fn kbps_to_bps(kbps: Option<u32>) -> Option<NonZeroU32> {
    kbps.and_then(|k| NonZeroU32::new(k.saturating_mul(1024)))
}

fn in_window(now: u16, start: u16, end: u16) -> bool {
    if start <= end {
        now >= start && now < end
    } else {
        // Window wraps past midnight, e.g. 22:00-06:00.
        now >= start || now < end
    }
}
