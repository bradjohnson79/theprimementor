import { SignUp } from "@clerk/react";
import { clerkAuthAppearance } from "../lib/authFormStyles";
import { useFrozenClerkRedirect } from "../lib/clerkRedirect";

export default function SignUpPage() {
  const redirectUrl = useFrozenClerkRedirect();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1f] px-4 py-10">
      <SignUp
        routing="path"
        path="/sign-up"
        fallbackRedirectUrl={redirectUrl}
        signInUrl="/sign-in"
        appearance={clerkAuthAppearance}
      />
    </div>
  );
}
