// // app/hooks/useCurrentUser.ts
// "use client";

// import { useEffect, useState } from "react";
// import { getCurrentUser } from "@/utils/api";

// export interface CurrentUser {
//   id: string;
//   email: string;
//   role: string;
// }

// export function useCurrentUser() {
//   const [user, setUser] = useState<CurrentUser | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     getCurrentUser()
//       .then(setUser)
//       .catch(() => setUser(null))
//       .finally(() => setLoading(false));
//   }, []);

//   return { user, loading };
// }

// app/hooks/useCurrentUser.ts
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
  }>;
}

export function useCurrentUser() {
  const { data: user = null, isLoading, error } = useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(),
    staleTime: 60_000,
  });

  return {
    user,
    loading: isLoading,
    error: error ? "Failed to load user information" : null,
  };
}