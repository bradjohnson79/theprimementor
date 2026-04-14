import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUserSync } from "../hooks/useUserSync";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getUmamiScriptUrl, getUmamiWebsiteId } from "../lib/analytics";

export default function ProtectedLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  useUserSync();
  useCurrentUser();

  useEffect(() => {
    const scriptId = "prime-mentor-umami";
    if (document.getElementById(scriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.defer = true;
    script.src = getUmamiScriptUrl();
    script.setAttribute("data-website-id", getUmamiWebsiteId());
    document.head.appendChild(script);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (!isSignedIn) {
    const redirectUrl = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} replace />;
  }

  return <Outlet />;
}
