"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function OwnerStandingPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";

  const { data, isLoading } = useQuery({
    queryKey: ["owner-standing", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/owner-standing/", {
        headers: { "X-School-ID": String(schoolId) },
      });
      return res.data;
    },
  });

  const n = (v: any) => Number(v || 0);

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <h1 className="text-xl font-bold">School standing (P&amp;L view)</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Owner snapshot: fee income vs operating expenses, plus what families and suppliers still owe.
      </p>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total income</p>
                <p className="text-xl font-bold text-emerald-700">
                  {currency} {n(data.total_income).toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Fees {n(data.total_fee_collected).toLocaleString()} · Admission{" "}
                  {n(data.pre_enrollment_income).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total expenses</p>
                <p className="text-xl font-bold text-rose-700">
                  {currency} {n(data.total_expenses).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Net position</p>
                <p
                  className={`text-xl font-bold ${
                    n(data.net_position) >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {currency} {n(data.net_position).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Receivables (fees owed)</p>
                <p className="text-xl font-bold">
                  {currency} {n(data.receivables_outstanding).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Payables (bills owed)</p>
                <p className="text-xl font-bold">
                  {currency} {n(data.payables_outstanding).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expenses by category</CardTitle>
            </CardHeader>
            <CardContent>
              {(data.expenses_by_category || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses categorised yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.expenses_by_category.map((r: any, i: number) => (
                    <li key={i} className="flex justify-between border-b border-slate-100 py-1">
                      <span>{r.category}</span>
                      <span className="font-medium">{n(r.total).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
