import { SignUp } from "@clerk/react";
import { clerkAuthAppearance } from "../lib/authFormStyles";
import { useFrozenClerkRedirect } from "../lib/clerkRedirect";

export default function SignUpPage() {
  const redirectUrl = useFrozenClerkRedirect();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1f] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <h1 className="text-3xl font-semibold text-white">Create a Free Account</h1>
          <p className="mt-2 text-sm text-slate-300">
            Sign up for free to access the platform and explore services before purchasing any membership.
          </p>
        </div>

        <SignUp
          routing="path"
          path="/sign-up"
          fallbackRedirectUrl={redirectUrl}
          signInUrl="/sign-in"
          appearance={clerkAuthAppearance}
        />
      </div>
    </div>
  );
}
