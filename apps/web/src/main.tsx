import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables");
}

/**
 * Prerendered public pages (scripts/prerender.mjs) ship real HTML inside
 * <div id="root" data-prerendered>. The SPA still boots with createRoot (not
 * hydrateRoot: the static snapshot is not guaranteed to match the first client
 * render, e.g. Clerk/auth state, rotating hero, lazy-route Suspense), so there
 * are no hydration-mismatch errors by design.
 *
 * To avoid a flash of the "Loading..." Suspense fallback, React renders into a
 * fresh, invisible #root next to the snapshot; once the real page heading
 * exists (or after a short timeout) the snapshot is removed and the live tree
 * is shown. Client-only pages (spa.html) skip all of this.
 */
function prepareRootContainer(): HTMLElement {
  const existing = document.getElementById("root")!;
  if (!existing.hasAttribute("data-prerendered") || existing.childElementCount === 0) {
    return existing;
  }

  // usePageMeta re-adds JSON-LD on mount; drop the snapshot copies to avoid duplicates.
  document.head.querySelectorAll('script[type="application/ld+json"][data-page-meta]').forEach((node) => node.remove());

  existing.id = "prerender-root";
  const live = document.createElement("div");
  live.id = "root";
  live.style.cssText = "position:absolute;top:0;left:0;width:100%;visibility:hidden;pointer-events:none;";
  existing.after(live);

  let done = false;
  const reveal = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    window.clearTimeout(timeout);
    existing.remove();
    live.style.cssText = "";
  };
  const isReady = () => live.querySelector("h1") !== null;
  const observer = new MutationObserver(() => {
    if (isReady()) window.requestAnimationFrame(reveal);
  });
  observer.observe(live, { childList: true, subtree: true });
  const timeout = window.setTimeout(reveal, 4000);
  return live;
}

createRoot(prepareRootContainer()).render(
  <StrictMode>
    <AppErrorBoundary>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
