import { useState } from "react";

const REDIRECT_STORAGE_KEY = "clerk_redirect";

export function useFrozenClerkRedirect() {
  const [redirectUrl] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect_url")?.trim();

    if (redirect) {
      sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirect);
      return redirect;
    }

    return sessionStorage.getItem(REDIRECT_STORAGE_KEY) || "/";
  });

  return redirectUrl;
}
