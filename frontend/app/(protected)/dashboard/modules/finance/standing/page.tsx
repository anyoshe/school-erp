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
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">School standing</h1>
          <p className="text-sm text-muted-foreground">
            Income by type · expenses · what is still owed both ways
          </p>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-emerald-800/70">Total income</p>
                <p className="text-2xl font-bold text-emerald-800 mt-1">
                  {currency} {n(data.total_income).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-rose-100 bg-gradient-to-br from-rose-50 to-white">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-rose-800/70">Total expenses</p>
                <p className="text-2xl font-bold text-rose-800 mt-1">
                  {currency} {n(data.total_expenses).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Net position</p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    n(data.net_position) >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {currency} {n(data.net_position).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-100">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-amber-900/70">Receivables (fees due)</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">
                  {currency} {n(data.receivables_outstanding).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Income breakdown</CardTitle>
                <p className="text-xs text-muted-foreground">
                  School fees are separate from interview and admission charges
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(data.income_breakdown || []).map((r: any, i: number) => (
                    <li
                      key={i}
                      className="flex justify-between items-center border-b border-slate-100 py-2 last:border-0"
                    >
                      <span className="text-slate-700">{r.label}</span>
                      <span className="font-semibold tabular-nums">
                        {currency} {n(r.total).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payables vs receivables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between rounded-xl bg-amber-50 px-4 py-3">
                  <span>Families still owe (receivables)</span>
                  <span className="font-bold">
                    {currency} {n(data.receivables_outstanding).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span>School still owes suppliers (payables)</span>
                  <span className="font-bold">
                    {currency} {n(data.payables_outstanding).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expenses by category</CardTitle>
            </CardHeader>
            <CardContent>
              {(data.expenses_by_category || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expenses yet. Record them under Finance → Expenses.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.expenses_by_category.map((r: any, i: number) => (
                    <li key={i} className="flex justify-between border-b border-slate-100 py-1.5">
                      <span>{r.category}</span>
                      <span className="font-medium tabular-nums">
                        {n(r.total).toLocaleString()}
                      </span>
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
