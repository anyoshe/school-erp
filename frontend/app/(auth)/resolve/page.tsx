// "use client";

// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { getCurrentUser } from "@/utils/api";

// export default function AuthResolvePage() {
//   const router = useRouter();

//   useEffect(() => {
//   async function resolveAuthFlow() {
//     try {
//       const user = await getCurrentUser(true);
//       console.log("1. FULL RAW USER DATA:", JSON.stringify(user, null, 2));

//       console.log("2. Has schools array?", !!user.schools, "Length:", user.schools?.length ?? "undefined");

//       if (!user.schools || user.schools.length === 0) {
//         console.log("3. No schools → redirect to SETUP");
//         router.replace("/onboarding/setup");
//         return;
//       }

//       const activeSchool = user.active_school || user.schools[0];
//       console.log("4. Active school chosen:", user.active_school ? "from active_school" : "from schools[0]");
//       console.log("5. Active school full object:", JSON.stringify(activeSchool, null, 2));

//       // Critical checks
//       console.log("6. setup_complete exists?", "setup_complete" in activeSchool);
//       console.log("7. setup_complete value:", activeSchool?.setup_complete);
//       console.log("8. Is setup_complete falsy?", !activeSchool?.setup_complete);

//       if (!activeSchool.setup_complete) {
//         console.log("9. SETUP INCOMPLETE CONDITION TRIGGERED → redirect to SETUP");
//         router.replace("/onboarding/setup");
//         return;
//       }

//       const modules = activeSchool.modules || [];
//       console.log("10. Modules exists?", !!activeSchool.modules);
//       console.log("11. Modules count:", modules.length);

//       if (modules.length === 0) {
//         console.log("12. NO MODULES → redirect to SELECT-MODULES");
//         router.replace("/onboarding/select-modules");
//         return;
//       }

//       console.log("13. ALL CONDITIONS PASSED → redirect to DASHBOARD");
//       router.replace("/dashboard");
//     } catch (error) {
//       console.error("Auth resolve failed:", error);
//       router.replace("/login");
//     }
//   }

//   resolveAuthFlow();
// }, [router]);

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
//       <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-600 rounded-full animate-spin" />
//       <p className="mt-6 text-gray-600 font-medium">Preparing your dashboard...</p>
//     </div>
//   );
// }

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/utils/api";

export default function AuthResolvePage() {
  const router = useRouter();

  useEffect(() => {
    console.log("=== AuthResolvePage MOUNTED ===");
    console.log("Starting auth resolution...");

    async function resolveAuthFlow() {
      try {
        console.log("Fetching fresh user data...");
        const user = await getCurrentUser(true);
        console.log("1. FULL USER DATA:", JSON.stringify(user, null, 2));

        console.log("2. Schools exists?", !!user.schools);
        console.log("3. Schools length:", user.schools?.length ?? "missing");

        if (!user.schools || user.schools.length === 0) {
          console.log("4. NO SCHOOLS → redirecting to /onboarding/setup");
          router.replace("/onboarding/setup");
          return;
        }

        const activeSchool = user.active_school || user.schools[0];
        console.log("5. Active school source:", user.active_school ? "active_school" : "schools[0]");
        console.log("6. Active school object:", JSON.stringify(activeSchool, null, 2));

        console.log("7. setup_complete KEY exists?", "setup_complete" in activeSchool);
        console.log("8. setup_complete VALUE:", activeSchool?.setup_complete);

        if (!activeSchool?.setup_complete) {
          console.log("9. SETUP_INCOMPLETE → redirecting to /onboarding/setup");
          router.replace("/onboarding/setup");
          return;
        }

        const modules = activeSchool.modules || [];
        console.log("10. Modules exists?", !!activeSchool.modules);
        console.log("11. Modules length:", modules.length);

        if (modules.length === 0) {
          console.log("12. NO MODULES → redirecting to /onboarding/select-modules");
          router.replace("/onboarding/select-modules");
          return;
        }

        console.log("13. ALL GOOD – redirecting to /dashboard");
        await new Promise(resolve => setTimeout(resolve, 300));
        router.replace("/dashboard");
      } catch (error) {
        console.error("=== AUTH RESOLVE CRASHED ===", error);
        router.replace("/login");
      } finally {
        console.log("=== AuthResolvePage FINISHED ===");
      }
    }

    resolveAuthFlow();

    return () => {
      console.log("=== AuthResolvePage UNMOUNTED ===");
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-600 rounded-full animate-spin" />
      <p className="mt-6 text-gray-600 font-medium">Preparing your dashboard...</p>
    </div>
  );
}