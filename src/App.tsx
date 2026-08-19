import { useEffect, useState } from "react";
import { MainContent } from "./app/MainContent";
import { Shell } from "./app/Shell";
import { AddTorrentDialog } from "./components/AddTorrentDialog";
import { DetailOverlay } from "./components/DetailOverlay";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { Snackbar } from "./components/Snackbar";
import { TitleBar } from "./components/TitleBar";
import { WebUiLogin } from "./components/WebUiLogin";
import { UNAUTHORIZED_EVENT } from "./lib/auth-token";
import { IS_TAURI } from "./lib/tauri-bridge";
import { useSettingsStore } from "./stores/settings";
import { useTorrentsStore } from "./stores/torrents";

function App() {
  const initTorrents = useTorrentsStore((s) => s.init);
  const initSettings = useSettingsStore((s) => s.init);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const onboardingCompleted = useSettingsStore((s) => s.settings.onboarding_completed);
  const [authenticated, setAuthenticated] = useState(IS_TAURI);

  useEffect(() => {
    if (!authenticated) return;
    void initTorrents();
    void initSettings();
  }, [authenticated, initTorrents, initSettings]);

  useEffect(() => {
    if (IS_TAURI) return;
    function onUnauthorized() {
      setAuthenticated(false);
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  if (!authenticated) {
    return <WebUiLogin onAuthenticated={() => setAuthenticated(true)} />;
  }

  if (settingsLoaded && !onboardingCompleted) {
    return (
      <div className="flex h-full flex-col bg-surface-sunken">
        {IS_TAURI && <TitleBar />}
        <div className="min-h-0 flex-1">
          <OnboardingScreen />
        </div>
      </div>
    );
  }

  return (
    <>
      <Shell>
        <MainContent />
      </Shell>
      <DetailOverlay />
      <AddTorrentDialog />
      <Snackbar />
    </>
  );
}

export default App;
