import { SignIn } from "@clerk/react";
import { useSearchParams } from "react-router-dom";

export default function SignInPage() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url")?.trim() || undefined;
  const signUpUrl = redirectUrl
    ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
    : "/sign-up";

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <SignIn routing="path" path="/sign-in" signUpUrl={signUpUrl} forceRedirectUrl={redirectUrl} />
    </div>
  );
}
