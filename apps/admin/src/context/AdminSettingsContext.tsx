/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LANGUAGE, normalizeLanguage, PLATFORM_TIMEZONE, type LanguageCode } from "@wisdom/utils";
import {
  ensureUserLanguage,
  getUserLanguage,
  hasExplicitLanguageSelection,
  resetUserLanguage,
  setUserLanguage,
} from "../lib/language";

export type ThemeMode = "dark" | "light" | "system";
export type DashboardView = "overview" | "clients" | "bookings" | "reports" | "payments";
export type DateFormat = "long" | "short" | "compact";
export type ExportFormat = "docx" | "pdf";

interface AdminProfileSettings {
  displayName: string;
  email: string;
  avatarDataUrl: string | null;
}

interface AdminSettingsState {
  themeMode: ThemeMode;
  language: LanguageCode;
  defaultDashboardView: DashboardView;
  timezone: string;
  dateFormat: DateFormat;
  autoRefresh: boolean;
  defaultExportFormat: ExportFormat;
  reportAutoSave: boolean;
  twoFactorEnabled: boolean;
  profile: AdminProfileSettings;
}

interface AdminSettingsContextValue {
  settings: AdminSettingsState;
  resolvedTheme: Exclude<ThemeMode, "system">;
  updateSettings: (patch: Partial<Omit<AdminSettingsState, "profile">>) => void;
  updateProfile: (patch: Partial<AdminProfileSettings>) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = "wt-admin-settings";

const defaultTimezone =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || PLATFORM_TIMEZONE
    : PLATFORM_TIMEZONE;

const defaultSettings: AdminSettingsState = {
  themeMode: "dark",
  language: DEFAULT_LANGUAGE,
  defaultDashboardView: "overview",
  timezone: defaultTimezone,
  dateFormat: "long",
  autoRefresh: true,
  defaultExportFormat: "docx",
  reportAutoSave: true,
  twoFactorEnabled: false,
  profile: {
    displayName: "",
    email: "",
    avatarDataUrl: null,
  },
};

const AdminSettingsContext = createContext<AdminSettingsContextValue | null>(null);

function getSystemTheme(): Exclude<ThemeMode, "system"> {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readInitialSettings(): AdminSettingsState {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    ensureUserLanguage();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }

    const parsed = JSON.parse(raw) as Partial<AdminSettingsState>;
    const language = hasExplicitLanguageSelection() ? getUserLanguage() : DEFAULT_LANGUAGE;
    return {
      ...defaultSettings,
      ...parsed,
      language: normalizeLanguage(language),
      profile: {
        ...defaultSettings.profile,
        ...(parsed.profile ?? {}),
      },
    };
  } catch {
    return defaultSettings;
  }
}

export function AdminSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AdminSettingsState>(readInitialSettings);
  const [systemTheme, setSystemTheme] = useState<Exclude<ThemeMode, "system">>(getSystemTheme);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    ensureUserLanguage();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");

    updateTheme();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateTheme);
      return () => mediaQuery.removeEventListener("change", updateTheme);
    }

    mediaQuery.addListener(updateTheme);
    return () => mediaQuery.removeListener(updateTheme);
  }, []);

  const resolvedTheme = settings.themeMode === "system" ? systemTheme : settings.themeMode;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.localStorage.setItem("divin8_language", settings.language);
  }, [settings]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(`theme-${resolvedTheme}`);
    root.dataset.theme = resolvedTheme;
    root.lang = settings.language;
  }, [resolvedTheme, settings.language]);

  const updateSettings = useCallback(
    (patch: Partial<Omit<AdminSettingsState, "profile">>) => {
      if (patch.language !== undefined) {
        setUserLanguage(normalizeLanguage(patch.language), true);
      }
      setSettings((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const updateProfile = useCallback((patch: Partial<AdminProfileSettings>) => {
    setSettings((current) => ({
      ...current,
      profile: {
        ...current.profile,
        ...patch,
      },
    }));
  }, []);

  const resetSettings = useCallback(() => {
    resetUserLanguage();
    setSettings((current) => ({
      ...defaultSettings,
      timezone: defaultTimezone,
      profile: current.profile,
      twoFactorEnabled: current.twoFactorEnabled,
    }));
  }, []);

  const value = useMemo<AdminSettingsContextValue>(
    () => ({
      settings,
      resolvedTheme,
      updateSettings,
      updateProfile,
      resetSettings,
    }),
    [resolvedTheme, resetSettings, settings, updateProfile, updateSettings],
  );

  return <AdminSettingsContext.Provider value={value}>{children}</AdminSettingsContext.Provider>;
}

export function useAdminSettings() {
  const context = useContext(AdminSettingsContext);
  if (!context) {
    throw new Error("useAdminSettings must be used within an AdminSettingsProvider");
  }

  return context;
}
