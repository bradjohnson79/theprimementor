import { useState } from "react";

const REDIRECT_STORAGE_KEY = "clerk_redirect";

export function sanitizeInternalRedirect(value: string | null | undefined, fallback = "/"): string {
  const raw = value?.trim() ?? "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) {
    return fallback;
  }
  return raw;
}

export function useFrozenClerkRedirect() {
  const [redirectUrl] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = sanitizeInternalRedirect(params.get("redirect_url"));

    if (params.get("redirect_url")?.trim() && redirect !== "/") {
      sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirect);
      return redirect;
    }

    return sanitizeInternalRedirect(sessionStorage.getItem(REDIRECT_STORAGE_KEY), "/");
  });

  return redirectUrl;
}
