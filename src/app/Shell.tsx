import type { ReactNode } from "react";
import { IS_TAURI } from "../lib/tauri-bridge";
import { SelectionActionBar } from "../components/SelectionActionBar";
import { Sidebar } from "../components/Sidebar";
import { StatusBar } from "../components/StatusBar";
import { TitleBar } from "../components/TitleBar";
import { TopBar } from "../components/TopBar";
import { useSettingsStore } from "../stores/settings";

export function Shell({ children }: { children: ReactNode }) {
  // With a background animation on, the shell itself goes transparent so it
  // shows through the gaps between the (still opaque) sidebar/topbar/cards —
  // the fixed BackgroundLayer sits just behind it in the stacking order.
  const animated = useSettingsStore((s) => s.settings.background_animation !== "none");

  return (
    <div className={`relative flex h-full flex-col ${animated ? "" : "bg-surface-sunken"}`}>
      {IS_TAURI && <TitleBar />}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative shrink-0">
            <TopBar />
            <SelectionActionBar />
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</main>
          <StatusBar />
        </div>
      </div>
    </div>
  );
}
