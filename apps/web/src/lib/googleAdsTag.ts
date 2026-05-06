/**
 * Google Ads global site tag (gtag.js).
 *
 * - Loads once per app lifetime (SPA); safe under React StrictMode.
 * - If gtag.js is already present (e.g. future GA4), only adds `config` for Ads — no duplicate loader script.
 * - Deferred with requestIdleCallback (fallback: setTimeout) as a practical analogue to Next.js `afterInteractive`.
 */

export const GOOGLE_ADS_MEASUREMENT_ID = "AW-16719129218";

const GTAG_LOADER_SCRIPT_ID = "prime-mentor-google-ads-gtag-js";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let googleAdsTagInitScheduled = false;

export function initGoogleAdsGlobalSiteTag(): void {
  if (typeof window === "undefined" || googleAdsTagInitScheduled) {
    return;
  }
  googleAdsTagInitScheduled = true;

  window.dataLayer = window.dataLayer ?? [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }

  const load = () => {
    const existingLoader = document.querySelector<HTMLScriptElement>(
      'script[src*="googletagmanager.com/gtag/js"]',
    );
    if (!existingLoader && !document.getElementById(GTAG_LOADER_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = GTAG_LOADER_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }

    window.gtag!("js", new Date());
    window.gtag!("config", GOOGLE_ADS_MEASUREMENT_ID);
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(load, { timeout: 2500 });
  } else {
    window.setTimeout(load, 0);
  }
}
