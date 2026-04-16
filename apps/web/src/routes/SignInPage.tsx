import { SignIn } from "@clerk/react";
import { clerkAuthAppearance } from "../lib/authFormStyles";
import { useFrozenClerkRedirect } from "../lib/clerkRedirect";

export default function SignInPage() {
  const redirectUrl = useFrozenClerkRedirect();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1f] px-4 py-10">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={redirectUrl}
        appearance={clerkAuthAppearance}
      />
    </div>
  );
}
