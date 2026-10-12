"use client";

import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertCircle } from "lucide-react";

export default function ParentPortalPage() {
  const { currentSchool } = useCurrentSchool();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-textPrimary tracking-tight">Parent Portal</h1>
        <p className="text-textMuted mt-2">
          Parent communication, fees visibility and student progress for {currentSchool?.name || "your school"}.
        </p>
      </div>

      <Card className="border border-border shadow-card rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary-700 to-primary-900 text-white">
          <div className="flex items-center gap-3">
            <Users className="h-7 w-7" />
            <CardTitle className="text-xl">Parent Portal Module</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-8 text-center space-y-6">
          <AlertCircle className="h-14 w-14 mx-auto text-secondary" />
          <h2 className="text-2xl font-semibold text-textPrimary">Coming Soon</h2>
          <p className="text-textMuted max-w-xl mx-auto">
            This module is under active development and will be available in an upcoming release.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
