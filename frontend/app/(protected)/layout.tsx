"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getToken } from "@/utils/auth";

/**
 * Auth gate that does not tear down the tree on refresh when a token exists.
 * Sidebar/navbar live in the dashboard layout and stay mounted.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, hasToken } = useCurrentUser();
  const tokenPresent = typeof window !== "undefined" ? !!getToken() : hasToken;

  useEffect(() => {
    if (!loading && !user && !tokenPresent) {
      router.replace("/login");
    }
  }, [loading, router, user, tokenPresent]);

  // No token and still checking → brief spinner
  if (!tokenPresent && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // No session → redirect handled above
  if (!tokenPresent && !user) {
    return null;
  }

  // Token present (or cached user) → render children immediately
  return <>{children}</>;
}
