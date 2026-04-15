import { SignIn } from "@clerk/react";
import { useState } from "react";

const REDIRECT_STORAGE_KEY = "clerk_signin_redirect";

export default function SignInPage() {
  const [redirectUrl] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("redirect_url")?.trim();
    if (fromUrl) {
      sessionStorage.setItem(REDIRECT_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(REDIRECT_STORAGE_KEY) || undefined;
  });
  const [signUpUrl] = useState(
    () => redirectUrl
      ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
      : "/sign-up",
  );

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <SignIn routing="path" path="/sign-in" signUpUrl={signUpUrl} fallbackRedirectUrl={redirectUrl || "/dashboard"} />
    </div>
  );
}
