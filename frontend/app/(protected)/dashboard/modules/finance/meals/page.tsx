"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FinanceNavLinks } from "../components/FinanceNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed } from "lucide-react";

/**
 * Meals is not a separate finance product.
 * Billing: fee structure optional / Returning billing "Include lunch".
 * Roster: Students → Lunch program.
 */
export default function MealsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/dashboard/modules/students/lunch");
    }, 2500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-2xl mx-auto">
      <FinanceNavLinks />
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Meals moved
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            The old Meals enrollment screen is retired. Lunch is part of school fees — not a
            parallel program.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Put Lunch on the fee structure</strong> (optional or mandatory item).
            </li>
            <li>
              <strong>New learners:</strong> structure lines only (optional lunch is not forced at
              clearance).
            </li>
            <li>
              <strong>Continuing learners:</strong> Finance → Returning billing → “Include lunch /
              meals on bill”.
            </li>
            <li>
              <strong>Who is on lunch + balances:</strong> Students → Lunch program.
            </li>
            <li>
              <strong>Collect money:</strong> Finance → Record payments (same as other fees).
            </li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild>
              <Link href="/dashboard/modules/students/lunch">Open lunch roster</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/modules/finance/returning">Returning billing</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/modules/finance/fee-structures">Fee structures</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Redirecting to the lunch roster…</p>
        </CardContent>
      </Card>
    </div>
  );
}
