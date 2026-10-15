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

function readCachedUser(): CurrentUser | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed?.user && parsed.cachedAt) return parsed.user as CurrentUser;
    if (parsed?.id) return parsed as CurrentUser;
    return undefined;
  } catch {
    return undefined;
  }
}

function writeCachedUser(user: CurrentUser | null) {
  try {
    if (user) {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ user, cachedAt: Date.now() })
      );
    } else {
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * SSR-safe: first paint is always the same (no window/token reads during render).
 * After mount, token + optional session cache hydrate, then network refresh.
 */
export function useCurrentUser() {
  const [mounted, setMounted] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [cached, setCached] = useState<CurrentUser | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    setHasToken(!!getToken());
    setCached(readCachedUser());
  }, []);

  const { data, isLoading, isFetching, error } = useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
    enabled: mounted && hasToken,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: cached,
  });

  const user = data ?? cached ?? null;

  useEffect(() => {
    if (data) writeCachedUser(data);
  }, [data]);

  return {
    user,
    // Never block chrome on SSR; only "loading" after mount with token and no user yet
    loading: mounted && hasToken && isLoading && !user,
    fetching: isFetching,
    error: error ? "Failed to load user information" : null,
    hasToken: mounted ? hasToken : false,
    mounted,
  };
}
