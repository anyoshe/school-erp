"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/utils/api";
import { getToken } from "@/utils/auth";

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  role_display?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  is_superuser?: boolean;
  force_change_password?: boolean;
  schools: Array<{
    id: string;
    name: string;
    setup_complete?: boolean;
    modules?: Array<{ id: number; name: string; code: string }>;
  }>;
  active_school?: {
    id: string;
    name: string;
    setup_complete?: boolean;
    modules?: Array<{ id: number; name: string; code: string }>;
  };
}

const CACHE_KEY = "erp_current_user_cache";
/** How long cached user is trusted without a network round-trip (30 min) */
const USER_CACHE_TTL_MS = 30 * 60 * 1000;

type UserCacheEnvelope = {
  user: CurrentUser;
  cachedAt: number;
};

function readUserCache(): UserCacheEnvelope | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    // Back-compat: older cache was the user object only
    if (parsed && parsed.user && typeof parsed.cachedAt === "number") {
      return parsed as UserCacheEnvelope;
    }
    if (parsed && parsed.id) {
      return { user: parsed as CurrentUser, cachedAt: Date.now() };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeUserCache(user: CurrentUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      const envelope: UserCacheEnvelope = { user, cachedAt: Date.now() };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
    } else {
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Session user for chrome (navbar).
 * If token + recent cache exist → return cache immediately and do NOT refetch
 * until the TTL expires. Module pages still fetch their own data.
 */
export function useCurrentUser() {
  const [mounted, setMounted] = useState(false);
  const [envelope, setEnvelope] = useState<UserCacheEnvelope | undefined>(undefined);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHasToken(!!getToken());
    setEnvelope(readUserCache());
  }, []);

  const cachedUser = envelope?.user;
  const cacheAge = envelope ? Date.now() - envelope.cachedAt : Infinity;
  const cacheFresh = !!cachedUser && cacheAge < USER_CACHE_TTL_MS;

  // Always refresh user when token exists; cache only speeds up first paint.
  const shouldFetch = mounted && hasToken;

  const { data, isLoading, isFetching, error } = useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
    enabled: shouldFetch,
    staleTime: 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: cachedUser,
    initialData: cacheFresh ? cachedUser : undefined,
    initialDataUpdatedAt: cacheFresh && envelope ? envelope.cachedAt : undefined,
  });

  const user = data ?? cachedUser ?? null;

  useEffect(() => {
    if (data) writeUserCache(data);
  }, [data]);

  const loading = !mounted ? false : hasToken ? isLoading && !user : false;

  return {
    user,
    loading,
    fetching: isFetching,
    error: error ? "Failed to load user information" : null,
    hasToken: mounted ? hasToken : false,
    mounted,
    /** True when chrome is serving session cache (no user network call needed) */
    fromCache: !!cacheFresh && !shouldFetch,
  };
}
