import { useState } from "react";
import CustomSignUp from "../components/CustomSignUp";

const REDIRECT_STORAGE_KEY = "clerk_signup_redirect";

export default function SignUpPage() {
  const [redirectUrl] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("redirect_url")?.trim();
    if (fromUrl) {
      sessionStorage.setItem(REDIRECT_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(REDIRECT_STORAGE_KEY) || undefined;
  });

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <CustomSignUp redirectUrl={redirectUrl} signInUrl="/sign-in" />
    </div>
  );
}
