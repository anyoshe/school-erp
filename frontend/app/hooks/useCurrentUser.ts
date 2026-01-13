// app/hooks/useCurrentUser.ts
"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/utils/api";

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
