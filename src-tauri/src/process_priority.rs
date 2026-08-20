use crate::settings::ProcessMemoryPriority;

/// Applies the configured OS process priority. Windows-only (matches the
/// "Process Memory Priority" Settings option) — a no-op elsewhere, since
/// there's no single cross-platform equivalent worth hand-rolling per OS
/// for what's a minor scheduling hint.
pub fn apply(priority: ProcessMemoryPriority) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Threading::{
            BELOW_NORMAL_PRIORITY_CLASS, GetCurrentProcess, IDLE_PRIORITY_CLASS,
            NORMAL_PRIORITY_CLASS, SetPriorityClass,
        };

        let class = match priority {
            ProcessMemoryPriority::Normal => NORMAL_PRIORITY_CLASS,
            ProcessMemoryPriority::BelowNormal => BELOW_NORMAL_PRIORITY_CLASS,
            ProcessMemoryPriority::Idle => IDLE_PRIORITY_CLASS,
        };
        unsafe {
            if let Err(e) = SetPriorityClass(GetCurrentProcess(), class) {
                tracing::warn!("failed to set process priority: {e}");
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = priority;
    }
}
