declare global {
  interface Window {
    umami?: {
      track: (event?: string | Record<string, unknown> | ((props: Record<string, unknown>) => Record<string, unknown>)) => Promise<void> | void;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_UMAMI_SCRIPT_URL?: string;
    readonly VITE_UMAMI_WEBSITE_ID?: string;
  }
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
  services_category_view: "services_category_view",
  service_card_view: "service_card_view",
  service_cta_click: "service_cta_click",
  offline_intake_start: "offline_intake_start",
  offline_intake_complete: "offline_intake_complete",
  checkout_start: "checkout_start",
  webinar_view: "webinar_view",
  webinar_registration_started: "webinar_registration_started",
  webinar_checkout_created: "webinar_checkout_created",
  webinar_purchase_completed: "webinar_purchase_completed",
  webinar_zoom_registration_clicked: "webinar_zoom_registration_clicked",
  webinar_dashboard_viewed: "webinar_dashboard_viewed",
  webinar_home_view: "webinar_home_view",
  webinar_learn_more_clicked: "webinar_learn_more_clicked",
  webinar_checkout_started: "webinar_checkout_started",
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_NAMES;

const PUBLIC_HOSTS = new Set(["theprimementor.com", "www.theprimementor.com"]);
const PRIVATE_PATH_PREFIXES = ["/dashboard", "/account", "/admin", "/settings", "/members"];

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

export function getUmamiScriptUrl() {
  return import.meta.env.VITE_UMAMI_SCRIPT_URL?.trim() || "";
}

export function getUmamiWebsiteId() {
  return import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim() || "";
}

export function isPublicAnalyticsPath(path: string) {
  const pathname = path.split("?")[0] || "/";
  return !PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const SENSITIVE_ANALYTICS_QUERY = /token|email|session|intake|code|secret|password|phone/i;

export function sanitizeAnalyticsPath(path: string) {
  try {
    const url = new URL(path, "https://theprimementor.com");
    if (url.origin !== "https://theprimementor.com") {
      return "/";
    }
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_ANALYTICS_QUERY.test(key)) {
        url.searchParams.delete(key);
      }
    }
    const query = url.searchParams.toString();
    return `${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return "/";
  }
}

function currentPath() {
  return sanitizeAnalyticsPath(`${window.location.pathname}${window.location.search}`);
}

function trackingHostAllowed() {
  return PUBLIC_HOSTS.has(window.location.hostname);
}

function whenUmamiReady(work: () => void) {
  if (!isBrowser() || !trackingHostAllowed()) {
    return;
  }

  if (typeof window.umami?.track === "function") {
    work();
    return;
  }

  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (typeof window.umami?.track === "function") {
      window.clearInterval(timer);
      work();
      return;
    }
    if (Date.now() - startedAt > 8000) {
      window.clearInterval(timer);
    }
  }, 100);
}

export function installAnalyticsScript() {
  if (!isBrowser() || !trackingHostAllowed()) {
    return () => undefined;
  }

  const scriptUrl = getUmamiScriptUrl();
  const websiteId = getUmamiWebsiteId();
  if (!scriptUrl || !websiteId) {
    return () => undefined;
  }

  const scriptId = "prime-mentor-umami";
  if (document.getElementById(scriptId)) {
    return () => undefined;
  }

  const script = document.createElement("script");
  script.id = scriptId;
  script.defer = true;
  script.src = scriptUrl;
  script.setAttribute("data-website-id", websiteId);
  script.setAttribute("data-auto-track", "false");
  script.setAttribute("data-domains", "theprimementor.com,www.theprimementor.com");
  script.setAttribute("data-exclude-search", "true");
  script.setAttribute("data-exclude-hash", "true");
  document.head.appendChild(script);

  return () => {
    script.remove();
  };
}

export function trackPageview(path?: string) {
  const safePath = sanitizeAnalyticsPath(path || currentPath());
  if (!isPublicAnalyticsPath(safePath)) {
    return;
  }
  whenUmamiReady(() => {
    const website = getUmamiWebsiteId();
    if (!website) {
      return;
    }
    void window.umami?.track({
      website,
      url: safePath,
      title: document.title,
    });
  });
}

export function trackEvent(eventName: AnalyticsEventName, _payload?: Record<string, unknown>) {
  whenUmamiReady(() => {
    void window.umami?.track(ANALYTICS_EVENT_NAMES[eventName]);
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
