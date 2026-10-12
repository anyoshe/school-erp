"use client";

import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Library, AlertCircle, BookOpen, Users, Search } from "lucide-react";

export default function LibraryPage() {
  const { currentSchool } = useCurrentSchool();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-textPrimary tracking-tight">Library Management</h1>
        <p className="text-textMuted mt-2">
          Catalog books, manage loans, and track library resources for {currentSchool?.name || "your school"}.
        </p>
      </div>

      <Card className="border border-border shadow-card rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary-700 to-primary-900 text-white">
          <div className="flex items-center gap-3">
            <Library className="h-7 w-7" />
            <CardTitle className="text-xl">Library Module</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-8 text-center space-y-6">
          <AlertCircle className="h-14 w-14 mx-auto text-secondary" />
          <h2 className="text-2xl font-semibold text-textPrimary">Coming Soon</h2>
          <p className="text-textMuted max-w-xl mx-auto">
            Book catalog, borrowing & returns, overdue tracking, and student reading history will live here.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-4">
            {[
              { icon: BookOpen, label: "Catalog" },
              { icon: Users, label: "Loans & Returns" },
              { icon: Search, label: "Search & Reserve" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary-50 border border-primary-100">
                <Icon className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-textPrimary">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
