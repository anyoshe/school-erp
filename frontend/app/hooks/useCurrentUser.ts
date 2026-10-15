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
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return undefined;
  }
}

function writeCachedUser(user: CurrentUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function useCurrentUser() {
  // Defer browser-only reads until after mount so SSR + first client paint match
  const [mounted, setMounted] = useState(false);
  const [cached, setCached] = useState<CurrentUser | undefined>(undefined);
  const [hasToken, setHasToken] = useState(false);

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

  // While not mounted, treat as "not loading shell" — layouts render consistently
  const loading = !mounted ? false : hasToken ? isLoading && !user : false;

  return {
    user,
    loading,
    fetching: isFetching,
    error: error ? "Failed to load user information" : null,
    hasToken: mounted ? hasToken : false,
    mounted,
  };
}
