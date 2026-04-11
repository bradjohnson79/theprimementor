import { SignUp } from "@clerk/react";
import { useSearchParams } from "react-router-dom";

export default function SignUpPage() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url")?.trim() || undefined;

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
