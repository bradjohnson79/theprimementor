import { useEffect, useRef, useState } from "react";
import { useAuth, useUser, SignIn } from "@clerk/react";
import { Outlet } from "react-router-dom";
import { api } from "../lib/api";
import Loading from "../components/Loading";

const CLIENT_APP_URL = import.meta.env.VITE_APP_URL?.trim() || "";

function getClientDashboardHref() {
  return CLIENT_APP_URL ? new URL("/dashboard", CLIENT_APP_URL).toString() : "/dashboard";
}

type GuardState =
  | "loading"
  | "signed-out"
  | "access-denied"
  | "service-unavailable"
  | "admin";

export default function AdminGuard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [state, setState] = useState<GuardState>("loading");
  const [attempt, setAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Avoid full-screen loading + outlet unmount when Clerk refetches `user` with the same id. */
  const verifiedAdminRef = useRef(false);
  const lastVerifiedClerkUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      verifiedAdminRef.current = false;
      lastVerifiedClerkUserIdRef.current = null;
      setState("signed-out");
      setErrorMessage(null);
      return;
    }

    const clerkUserId = user?.id ?? null;

    if (
      verifiedAdminRef.current
      && clerkUserId !== null
      && lastVerifiedClerkUserIdRef.current === clerkUserId
    ) {
      return;
    }

    let cancelled = false;

    async function checkRole() {
      try {
        const showFullScreenLoading = !verifiedAdminRef.current;
        if (!cancelled && showFullScreenLoading) {
          setState("loading");
          setErrorMessage(null);
        }

        const token = await getToken();
        let dbUser: { role: string };
        try {
          dbUser = await api.get("/me", token);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";

          if (
            (message.includes("User not found in database")
              || message.includes("Unable to sync authenticated user"))
            && user
          ) {
            await api.post("/sync-user", undefined, token);
            dbUser = await api.get("/me", token);
          } else {
            throw error;
          }
        }

        if (cancelled) return;

        const isAdmin = dbUser.role === "admin";
        if (isAdmin) {
          verifiedAdminRef.current = true;
          lastVerifiedClerkUserIdRef.current = clerkUserId ?? user?.id ?? null;
          setState("admin");
        } else {
          verifiedAdminRef.current = false;
          lastVerifiedClerkUserIdRef.current = null;
          setState("access-denied");
        }
      } catch (error) {
        if (!cancelled) {
          verifiedAdminRef.current = false;
          lastVerifiedClerkUserIdRef.current = null;
          const message = error instanceof Error ? error.message : "Unable to reach the admin API.";
          setErrorMessage(message);
          setState("service-unavailable");
        }
      }
    }

    void checkRole();
    return () => {
      cancelled = true;
    };
    // Intentionally omit `user` object identity — Clerk may replace the reference often.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable gate: attempt + auth + clerk user id
  }, [attempt, isLoaded, isSignedIn, getToken, user?.id]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy">
        <div className="aurora-bg" />
        <Loading />
      </div>
    );
  }

  if (state === "signed-out") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy">
        <div className="aurora-bg" />
        <div className="relative z-10">
          <SignIn routing="hash" />
        </div>
      </div>
    );
  }

  if (state === "access-denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-navy text-center">
        <div className="aurora-bg" />
        <div className="glass-card relative z-10 max-w-md p-8">
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="mt-3 text-white/60">
            You do not have admin privileges. Contact your administrator if you
            believe this is an error.
          </p>
          <a
            href={getClientDashboardHref()}
            className="mt-6 inline-block rounded-lg bg-accent-cyan/20 px-6 py-2.5 text-sm font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/30"
          >
            Go to Client Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (state === "service-unavailable") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-navy text-center">
        <div className="aurora-bg" />
        <div className="glass-card relative z-10 max-w-md p-8">
          <h1 className="text-2xl font-bold text-white">Admin Unavailable</h1>
          <p className="mt-3 text-white/60">
            The admin dashboard could not verify your access because the API is currently unavailable
            or still starting up.
          </p>
          {errorMessage ? (
            <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              {errorMessage}
            </p>
          ) : null}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="rounded-lg bg-accent-cyan/20 px-6 py-2.5 text-sm font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/30"
            >
              Retry Admin Check
            </button>
            <a
              href={getClientDashboardHref()}
              className="rounded-lg border border-white/10 px-6 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              Go to Client Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
