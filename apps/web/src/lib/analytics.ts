declare global {
  interface Window {
    goatcounter?: {
      count?: (options?: GoatCounterCountOptions) => void;
      url?: (options?: GoatCounterCountOptions) => string;
      filter?: () => string | false;
      bind_events?: () => void;
      get_query?: (name: string) => string | undefined;
      endpoint?: string;
      no_onload?: boolean;
      no_events?: boolean;
      allow_local?: boolean;
      allow_frame?: boolean;
      path?: string | ((path: string) => string | null);
      title?: string;
      referrer?: string | (() => string);
      event?: boolean;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_GOATCOUNTER_ENDPOINT?: string;
    readonly VITE_GOATCOUNTER_SCRIPT_URL?: string;
  }
}

interface GoatCounterCountOptions {
  path?: string | ((path: string) => string | null);
  title?: string;
  referrer?: string;
  event?: boolean;
  no_session?: boolean;
}

export const ANALYTICS_EVENT_NAMES = {
  signup: "signup",
  purchase: "purchase",
  subscription_started: "subscription_started",
  session_booked: "session_booked",
  cta_click: "cta_click",
  report_view: "report_view",
  sample_view: "sample_view",
  report_order_click: "report_order_click",
  report_checkout_start: "report_checkout_start",
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_NAMES;

const DEFAULT_GOATCOUNTER_ENDPOINT = "https://primementor.goatcounter.com/count";
const DEFAULT_GOATCOUNTER_SCRIPT_URL = "https://gc.zgo.at/count.js";

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

export function getGoatCounterEndpoint() {
  return import.meta.env.VITE_GOATCOUNTER_ENDPOINT?.trim() || DEFAULT_GOATCOUNTER_ENDPOINT;
}

export function getGoatCounterScriptUrl() {
  return import.meta.env.VITE_GOATCOUNTER_SCRIPT_URL?.trim() || DEFAULT_GOATCOUNTER_SCRIPT_URL;
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function whenGoatCounterReady(work: () => void) {
  if (!isBrowser()) {
    return;
  }

  if (typeof window.goatcounter?.count === "function") {
    work();
    return;
  }

  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (typeof window.goatcounter?.count === "function") {
      window.clearInterval(timer);
      work();
      return;
    }
    if (Date.now() - startedAt > 8000) {
      window.clearInterval(timer);
    }
  }, 100);
}

export function installGoatCounterScript() {
  if (!isBrowser()) {
    return () => undefined;
  }

  const endpoint = getGoatCounterEndpoint();
  if (!endpoint) {
    return () => undefined;
  }

  window.goatcounter = {
    ...(window.goatcounter ?? {}),
    no_onload: true,
    allow_local: import.meta.env.DEV,
    endpoint,
    referrer() {
      return window.goatcounter?.get_query?.("ref")
        || window.goatcounter?.get_query?.("utm_campaign")
        || window.goatcounter?.get_query?.("utm_source")
        || document.referrer;
    },
  };

  if (document.querySelector("script[data-goatcounter]")) {
    return () => undefined;
  }

  const scriptId = "prime-mentor-goatcounter";
  if (document.getElementById(scriptId)) {
    return () => undefined;
  }

  const script = document.createElement("script");
  script.id = scriptId;
  script.async = true;
  script.src = getGoatCounterScriptUrl();
  script.setAttribute("data-goatcounter", endpoint);
  document.head.appendChild(script);

  return () => {
    script.remove();
  };
}

export function trackPageview(path?: string) {
  whenGoatCounterReady(() => {
    window.goatcounter?.count?.({
      path: path || currentPath(),
      title: document.title,
    });
    window.goatcounter?.bind_events?.();
  });
}

export function trackEvent(eventName: AnalyticsEventName, payload?: Record<string, unknown>) {
  whenGoatCounterReady(() => {
    window.goatcounter?.count?.({
      path: ANALYTICS_EVENT_NAMES[eventName],
      title: payload ? JSON.stringify(payload) : eventName,
      event: true,
    });
  });
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
