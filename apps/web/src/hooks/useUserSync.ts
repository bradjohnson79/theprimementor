import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { api } from "../lib/api";
import { trackEvent } from "../lib/analytics";

const SIGNUP_TRACKING_KEY_PREFIX = "prime-mentor-signup-tracked:";
const SYNC_KEY_PREFIX = "prime-mentor-user-synced:";

export function useUserSync() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      synced.current = false;
      return;
    }

    if (!isLoaded || !isSignedIn || synced.current || !userId) return;

    const syncKey = `${SYNC_KEY_PREFIX}${userId}`;
    if (window.sessionStorage.getItem(syncKey) === "1") {
      synced.current = true;
      return;
    }

    synced.current = true;

    void (async () => {
      try {
        const token = await getToken();
        const response = (await api.post("/sync-user", undefined, token)) as {
          created?: boolean;
          user?: { role?: string; email?: string };
        };

        const trackingKey = `${SIGNUP_TRACKING_KEY_PREFIX}${userId}`;
        if (response.created && window.sessionStorage.getItem(trackingKey) !== "1") {
          trackEvent("signup", {
            source: "clerk_sync",
            role: response.user?.role ?? "client",
          });
          window.sessionStorage.setItem(trackingKey, "1");
        }
        window.sessionStorage.setItem(syncKey, "1");
      } catch (err: unknown) {
        console.error("[useUserSync] failed:", err);
        synced.current = false;
      }
    })();
  }, [getToken, isLoaded, isSignedIn, userId]);
}
