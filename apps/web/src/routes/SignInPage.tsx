import { SignIn } from "@clerk/react";
import { useState } from "react";

export default function SignInPage() {
  // Capture redirect URL exactly once on mount so Clerk's internal
  // step-navigation never changes these props mid-flow.
  const [redirectUrl] = useState(
    () => new URLSearchParams(window.location.search).get("redirect_url")?.trim() || undefined,
  );
  const [signUpUrl] = useState(
    () => redirectUrl
      ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
      : "/sign-up",
  );

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <SignIn routing="path" path="/sign-in" signUpUrl={signUpUrl} forceRedirectUrl={redirectUrl} />
    </div>
  );
}
