import { ReviewFilesScreen } from "../components/ReviewFilesScreen";
import { TorrentGrid } from "../components/TorrentGrid";
import { useUiStore } from "../stores/ui";
import { NetworkScreen } from "./NetworkScreen";
import { RssScreen } from "./RssScreen";
import { SearchScreen } from "./SearchScreen";
import { SettingsScreen } from "./SettingsScreen";

export function MainContent() {
  const section = useUiStore((s) => s.section);
  const reviewPreview = useUiStore((s) => s.reviewPreview);

  if (reviewPreview) return <ReviewFilesScreen />;
  if (section === "network") return <NetworkScreen />;
  if (section === "settings") return <SettingsScreen />;
  if (section === "rss") return <RssScreen />;
  if (section === "search") return <SearchScreen />;
  return <TorrentGrid />;
}
