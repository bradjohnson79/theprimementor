import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { api } from "../lib/api";

export function useUserSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      synced.current = false;
      return;
    }

    if (!isLoaded || !isSignedIn || synced.current) {
      return;
    }

    synced.current = true;

    void (async () => {
      try {
        const token = await getToken();
        await api.post("/sync-user", undefined, token);
      } catch (error: unknown) {
        console.error("[admin/useUserSync] failed:", error);
        synced.current = false;
      }
    })();
  }, [getToken, isLoaded, isSignedIn]);
}
