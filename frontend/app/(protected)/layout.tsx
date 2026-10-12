"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * Lightweight auth gate for the (protected) segment.
 * Does NOT replace the whole tree with a spinner once a user is known,
 * so child layouts (sidebar/navbar) stay mounted during navigation.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  // First visit only – after that react-query cache keeps user available
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
