import { useCallback } from "react";
import { useSettingsStore } from "../stores/settings";
import { translate, type TranslationKey } from "./i18n";

/** `const t = useT(); t("nav_library")` — resolves against the user's Settings → Language. */
export function useT(): (key: TranslationKey) => string {
  const language = useSettingsStore((s) => s.settings.language);
  return useCallback((key: TranslationKey) => translate(language, key), [language]);
}
