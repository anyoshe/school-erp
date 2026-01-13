// components/auth/SettingsGuard.tsx
"use client";

import { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

export default function SettingsGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser();
  const { currentSchool } = useCurrentSchool();

  if (loading) {
    return <div className="p-6 text-gray-500">Checking access…</div>;
  }

  if (!user || !currentSchool) return null;

  const isAllowed =
    user.role === "admin" ||
    user.role === "owner" ||
    currentSchool.owner === user.id; // backend field

  if (!isAllowed) {
    return (
      <div className="p-8 text-center text-gray-600">
        You do not have permission to access settings.
      </div>
    );
  }

  return <>{children}</>;
}
