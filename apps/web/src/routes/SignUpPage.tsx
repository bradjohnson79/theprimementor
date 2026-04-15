import { SignUp } from "@clerk/react";
import { useState } from "react";

export default function SignUpPage() {
  // Capture redirect URL exactly once on mount so Clerk's internal
  // step-navigation (e.g. /sign-up → /sign-up/verify-email-address)
  // never changes this prop and never re-triggers verification.
  const [redirectUrl] = useState(
    () => new URLSearchParams(window.location.search).get("redirect_url")?.trim() || undefined,
  );

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={redirectUrl}
      />
    </div>
  );
}
