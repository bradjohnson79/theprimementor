export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isSupportedLanguage(code: string): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some((language) => language.code === code);
}

export function normalizeLanguage(code: unknown): LanguageCode {
  return typeof code === "string" && isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
}

export function languageLabel(code: LanguageCode) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.label ?? "English";
}
