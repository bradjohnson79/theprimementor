import { useMemo } from "react";
import type { LanguageCode } from "@wisdom/utils";
import { useAdminSettings } from "../context/AdminSettingsContext";
import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";

const dictionaries: Record<LanguageCode, Record<string, string>> = { en, es, fr, de };

const localeMap: Record<LanguageCode, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
};

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) {
    return template;
  }

  return template.replace(/\{\{(.*?)\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    return String(values[key] ?? "");
  });
}

export function getAdminLocale(language: LanguageCode) {
  return localeMap[language] ?? localeMap.en;
}

export function useI18n() {
  const { settings } = useAdminSettings();

  return useMemo(() => {
    const dictionary = dictionaries[settings.language] ?? dictionaries.en;
    const fallback = dictionaries.en;

    function t(key: string, values?: Record<string, string | number>) {
      const template = dictionary[key] ?? fallback[key] ?? key;
      return interpolate(template, values);
    }

    function plural(baseKey: string, count: number, values?: Record<string, string | number>) {
      const suffix = count === 1 ? "_one" : "_other";
      return t(`${baseKey}${suffix}`, { count, ...(values ?? {}) });
    }

    return {
      language: settings.language,
      locale: getAdminLocale(settings.language),
      t,
      plural,
    };
  }, [settings.language]);
}
