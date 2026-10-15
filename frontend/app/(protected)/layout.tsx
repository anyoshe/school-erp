"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getToken } from "@/utils/auth";

/**
 * Auth gate only. Never render a spinner based on window/token (SSR mismatch).
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!getToken() && !user) {
      router.replace("/login");
    }
  }, [mounted, loading, user, router]);

  return <>{children}</>;
}
