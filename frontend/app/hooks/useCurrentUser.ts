"use client";

import { useEffect } from "react";
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
    /* ignore quota */
  }
}

export function useCurrentUser() {
  const hasToken = typeof window !== "undefined" && !!getToken();
  const cached = typeof window !== "undefined" ? readCachedUser() : undefined;

  const { data: user = null, isLoading, isFetching, error, isPending } = useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
    enabled: hasToken,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // Instant shell on refresh when we already know the user
    placeholderData: cached,
  });

  useEffect(() => {
    if (user) writeCachedUser(user);
  }, [user]);

  // Only block UI when we have no token/user and are still loading
  const loading = hasToken ? isLoading && !user && !cached : isPending || isLoading;

  return {
    user: user ?? cached ?? null,
    loading: loading && !cached,
    fetching: isFetching,
    error: error ? "Failed to load user information" : null,
    hasToken,
  };
}
