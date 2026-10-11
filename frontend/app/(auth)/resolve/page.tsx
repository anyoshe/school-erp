"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/utils/api";

export default function AuthResolvePage() {
  const router = useRouter();

  useEffect(() => {
    console.log("=== AuthResolvePage MOUNTED ===");
    console.log("Starting user redirection resolution...");

    async function resolveUserFlow() {
      try {
        console.log("Fetching current user...");
        const user = await getCurrentUser(true);
        console.log("User data:", JSON.stringify(user, null, 2));

        if (!user.schools || user.schools.length === 0) {
          console.log("→ No schools → /onboarding/setup");
          router.replace("/onboarding/setup");
          return;
        }

        const activeSchool = user.active_school || user.schools[0];
        console.log("Active school:", JSON.stringify(activeSchool, null, 2));

        if (!activeSchool?.setup_complete) {
          console.log("→ Setup incomplete → /onboarding/setup");
          router.replace("/onboarding/setup");
          return;
        }

        const modules = activeSchool.modules || [];
        if (modules.length === 0) {
          console.log("→ No modules → /onboarding/select-modules");
          router.replace("/onboarding/select-modules");
          return;
        }

        if (user.force_change_password) {
          console.log("→ Force password change → /auth/change-password?first=true");
          router.replace("/change-password?first=true");
          return;
        }

        console.log("→ All good → /dashboard");
        await new Promise((r) => setTimeout(r, 400));
        router.replace("/dashboard");

      } catch (error: any) {  // ← type as any
        console.error("Auth resolution failed:", error);

        // Safely check status
        const axiosError = error as { response?: { status?: number } };
        if (axiosError?.response?.status === 401 || axiosError?.response?.status === 403) {
          console.log("Unauthorized → redirect to /login");
          router.replace("/login");
        } else {
          console.log("Other error → fallback to /login");
          router.replace("/login");
        }
      } finally {
        console.log("=== AuthResolvePage FINISHED ===");
      }
    }

    resolveUserFlow();

    return () => {
      console.log("=== AuthResolvePage UNMOUNTED ===");
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6" />
      <h2 className="text-xl font-semibold text-indigo-900 mb-2">Preparing your experience...</h2>
      <p className="text-sm text-indigo-700">Just a moment while we set everything up.</p>
    </div>
  );
}