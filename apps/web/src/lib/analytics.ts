declare global {
  interface Window {
    umami?: {
      track: (...args: unknown[]) => void;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_UMAMI_WEBSITE_ID?: string;
    readonly VITE_UMAMI_SCRIPT_URL?: string;
  }
}

export const ANALYTICS_EVENT_NAMES = {
  signup: "signup",
  purchase: "purchase",
  subscription_started: "subscription_started",
  session_booked: "session_booked",
  cta_click: "cta_click",
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_NAMES;

const DEFAULT_UMAMI_WEBSITE_ID = "db9c7631-014a-4dc3-b9c2-967afed009f7";
const DEFAULT_UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";

function isBrowser() {
  return typeof window !== "undefined";
}

function hasTrackedKey(key: string) {
  if (!isBrowser()) {
    return true;
  }
  return window.sessionStorage.getItem(key) === "1";
}

function markTrackedKey(key: string) {
  if (!isBrowser()) {
    return;
  }
  window.sessionStorage.setItem(key, "1");
}

export function getUmamiWebsiteId() {
  return import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim() || DEFAULT_UMAMI_WEBSITE_ID;
}

export function getUmamiScriptUrl() {
  return import.meta.env.VITE_UMAMI_SCRIPT_URL?.trim() || DEFAULT_UMAMI_SCRIPT_URL;
}

export function trackEvent(eventName: AnalyticsEventName, payload?: Record<string, unknown>) {
  if (!isBrowser() || typeof window.umami?.track !== "function") {
    return;
  }

  window.umami.track(ANALYTICS_EVENT_NAMES[eventName], payload ?? {});
}

export function trackEventOnce(key: string, eventName: AnalyticsEventName, payload?: Record<string, unknown>) {
  if (hasTrackedKey(key)) {
    return;
  }
  trackEvent(eventName, payload);
  markTrackedKey(key);
}

export function trackCtaClick(label: string, source: string, payload?: Record<string, unknown>) {
  trackEvent("cta_click", {
    label,
    source,
    ...payload,
  });
}
