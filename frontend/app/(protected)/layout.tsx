"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getToken } from "@/utils/auth";

/**
 * Auth gate. Avoids SSR/client HTML mismatch by not branching on
 * window/token during the initial render.
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

  // Always render children on server + first client paint (same HTML).
  // Redirect runs only after mount when there is truly no session.
  return <>{children}</>;
}
