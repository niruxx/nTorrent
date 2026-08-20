import de from "./de";
import en, { type TranslationKey } from "./en";
import es from "./es";
import fr from "./fr";

export type { TranslationKey };

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
] as const;

const DICTIONARIES: Record<string, Record<TranslationKey, string>> = { en, es, fr, de };

export function translate(language: string, key: TranslationKey): string {
  return DICTIONARIES[language]?.[key] ?? en[key];
}
