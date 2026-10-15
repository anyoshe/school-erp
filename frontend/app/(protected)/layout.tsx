"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getToken } from "@/utils/auth";

/**
 * Auth gate only — never swap the tree for a spinner (that causes hydration mismatches).
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, mounted } = useCurrentUser();

  useEffect(() => {
    if (!mounted || loading) return;
    if (!getToken() && !user) {
      router.replace("/login");
    }
  }, [mounted, loading, user, router]);

  return <>{children}</>;
}
