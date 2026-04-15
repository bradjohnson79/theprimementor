import { useState } from "react";
import CustomSignUp from "../components/CustomSignUp";

export default function SignUpPage() {
  const [redirectUrl] = useState(
    () => new URLSearchParams(window.location.search).get("redirect_url")?.trim() || undefined,
  );

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <CustomSignUp redirectUrl={redirectUrl} signInUrl="/sign-in" />
    </div>
  );
}
