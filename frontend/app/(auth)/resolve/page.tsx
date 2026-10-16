"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/utils/api";
import { setActiveSchool, getActiveSchoolId, cacheActiveSchool, cacheSchoolsList } from "@/utils/auth";

export default function AuthResolvePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    async function resolveUserFlow() {
      try {
        const user = await getCurrentUser(true);
        if (cancelled) return;

        // Seed react-query cache so dashboard does not refetch immediately
        queryClient.setQueryData(["currentUser"], user);
        try {
          sessionStorage.setItem(
            "erp_current_user_cache",
            JSON.stringify({ user, cachedAt: Date.now() })
          );
        } catch { /* */ }

        if (user.force_change_password) {
          router.replace("/change-password?first=true");
          return;
        }

        if (user.is_superuser) {
          router.replace("/platform-admin");
          return;
        }

        if (!user.schools || user.schools.length === 0) {
          router.replace("/onboarding/setup");
          return;
        }

        const savedId = getActiveSchoolId();
        const activeSchool =
          user.schools.find((s: { id: string }) => s.id === savedId) ||
          user.active_school ||
          user.schools[0];

        if (activeSchool?.id) {
          setActiveSchool(activeSchool.id);
          cacheActiveSchool(activeSchool);
        }
        if (Array.isArray(user.schools)) {
          cacheSchoolsList(user.schools);
        }

        if (!activeSchool?.setup_complete) {
          router.replace("/onboarding/setup");
          return;
        }

        const modules = activeSchool.modules || [];
        if (modules.length === 0) {
          router.replace("/onboarding/select-modules");
          return;
        }

        router.replace("/dashboard");
      } catch {
        router.replace("/login");
      }
    }

    resolveUserFlow();
    return () => {
      cancelled = true;
    };
  }, [router, queryClient]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-5" />
      <h2 className="text-lg font-semibold text-textPrimary mb-1">Signing you in…</h2>
      <p className="text-sm text-textMuted">Almost there</p>
    </div>
  );
}
