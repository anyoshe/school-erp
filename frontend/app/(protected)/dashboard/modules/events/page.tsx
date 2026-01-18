"use client";

import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, AlertCircle } from "lucide-react";

export default function EventsPage() {
  const { currentSchool } = useCurrentSchool();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-slate-50 to-indigo-50/30 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900">Events & Extracurricular</h1>
          <p className="text-lg text-slate-600 mt-3">
            Plan and manage school events, clubs, sports, and activities
          </p>
        </div>

        {/* Coming Soon / Placeholder */}
        <Card className="bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-indigo-900 text-white">
            <div className="flex items-center gap-4">
              <CalendarDays className="h-8 w-8" />
              <CardTitle className="text-2xl">Events Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8 text-center space-y-6">
            <AlertCircle className="h-16 w-16 mx-auto text-amber-500" />
            <h2 className="text-2xl font-semibold text-slate-800">
              Module Under Construction
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              This vibrant events system is coming soon.
              You'll be able to schedule activities, manage participants, track budgets, and send notifications.
            </p>
            <div className="text-sm text-slate-500">
              Expected: Q1 2026
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}