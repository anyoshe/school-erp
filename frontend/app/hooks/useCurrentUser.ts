"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/utils/api";

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

export function useCurrentUser() {
  const { data: user = null, isLoading, isFetching, error } = useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
    staleTime: 5 * 60_000, // 5 minutes – avoid refetch on every navigation
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // use cache seeded by /resolve when available
  });

  return {
    user,
    loading: isLoading && !user,
    fetching: isFetching,
    error: error ? "Failed to load user information" : null,
  };
}
