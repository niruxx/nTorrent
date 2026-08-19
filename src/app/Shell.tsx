import type { ReactNode } from "react";
import { IS_TAURI } from "../lib/tauri-bridge";
import { SelectionActionBar } from "../components/SelectionActionBar";
import { Sidebar } from "../components/Sidebar";
import { TitleBar } from "../components/TitleBar";
import { TopBar } from "../components/TopBar";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-surface-sunken">
      {IS_TAURI && <TitleBar />}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative shrink-0">
            <TopBar />
            <SelectionActionBar />
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
