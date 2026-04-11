import { DEFAULT_LANGUAGE, normalizeLanguage, type LanguageCode } from "@wisdom/utils";

export const LANGUAGE_STORAGE_KEY = "divin8_language";
export const LANGUAGE_SELECTION_KEY = "wt-admin-language-selected";

export function getUserLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function hasExplicitLanguageSelection() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(LANGUAGE_SELECTION_KEY) === "true";
}

export function ensureUserLanguage() {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const normalized = normalizeLanguage(stored);

  if (!stored || stored !== normalized) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  }

  return normalized;
}

export function setUserLanguage(language: LanguageCode, explicit = true) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

  if (explicit) {
    window.localStorage.setItem(LANGUAGE_SELECTION_KEY, "true");
  }
}

export function resetUserLanguage() {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE);
  window.localStorage.removeItem(LANGUAGE_SELECTION_KEY);
  return DEFAULT_LANGUAGE;
}
