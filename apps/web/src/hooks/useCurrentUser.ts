import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import type { TierCapabilities } from "@wisdom/utils";
import { api } from "../lib/api";
import { getUserTier, type UserTierState } from "../lib/memberTier";

interface DbUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  member?: {
    tier: "seeker" | "initiate";
    subscriptionStatus: "active";
    billingInterval: "monthly" | "annual";
    capabilities: TierCapabilities;
    usage: {
      used: number;
      limit: number | null;
      periodStart: string;
      periodEnd: string;
    };
  };
}

export function useCurrentUser() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [user, setUser] = useState<DbUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tierState, setTierState] = useState<UserTierState>("loading");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const fetched = useRef(false);

  const refetch = useCallback(() => {
    fetched.current = false;
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      fetched.current = false;
      setUser(null);
      setTierState("free");
      setIsLoading(false);
      return;
    }

    if (!isLoaded || !isSignedIn || fetched.current) {
      if (isLoaded && !isSignedIn) setIsLoading(false);
      return;
    }

    fetched.current = true;
    setIsLoading(true);
    setTierState("loading");

    async function fetchMe() {
      try {
        const token = await getToken();
        const data = await api.get("/me", token);
        const nextTier = getUserTier(data?.member);
        setTierState(nextTier);
        setUser(data);
      } catch (err) {
        console.error("[useCurrentUser] failed:", err);
        setUser(null);
        setTierState("free");
        fetched.current = false;
      } finally {
        setIsLoading(false);
      }
    }

    fetchMe();
  }, [getToken, isLoaded, isSignedIn, refreshNonce]);

  return { user, isLoading, tierState, refetch };
}
