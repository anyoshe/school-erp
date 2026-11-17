"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

/** Phase A: module is not product-ready — kept out of default nav. */
export default function ProcurementPagePlaceholderPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-lg w-full rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Procurement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p>
            This module is not enabled in the product yet. It is intentionally hidden from the
            main menu so staff are not sent to an unfinished screen.
          </p>
          <p className="text-xs text-muted-foreground">
            Use Admissions, Students, Finance, Academics, Attendance, Library, Transport, HR, and
            Reports for day-to-day operations.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
