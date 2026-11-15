"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Search, UtensilsCrossed } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function money(v?: number | string | null) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "—";
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function StudentsLunchProgramPage() {
  const { currentSchool } = useCurrentSchool();
  const [q, setQ] = useState("");

  const listQ = useQuery({
    queryKey: ["lunch-roster", currentSchool?.id, q],
    queryFn: async () => {
      const { data } = await api.get("/finance/lunch/roster/", {
        params: q ? { q } : undefined,
      });
      return data as { count: number; results: any[] };
    },
    enabled: !!currentSchool?.id,
  });

  const rows = listQ.data?.results || [];
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.mealsBal += Number(r.meals_balance || 0);
        acc.out += Number(r.total_outstanding || 0);
        return acc;
      },
      { mealsBal: 0, out: 0 }
    );
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/modules/students"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Students
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-teal-700" />
            Lunch program
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Learners with lunch/meals on their fee structure or invoice. Balances are collected under
            Finance → Record payments (same as other school fees). Optional meals are added when
            billing returning students or when meals is non-optional on the structure — not at new-student clearance.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 w-[200px]"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">On program</p>
            <p className="text-xl font-semibold tabular-nums">{listQ.data?.count ?? rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Meals balances</p>
            <p className="text-xl font-semibold tabular-nums">{money(totals.mealsBal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total outstanding (all fees)</p>
            <p className="text-xl font-semibold tabular-nums">{money(totals.out)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Learners</CardTitle>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !rows.length ? (
            <p className="text-sm text-muted-foreground py-6">
              No lunch program learners yet. Include lunch when billing under Finance → Returning
              billing, or put Lunch/meals as a non-optional line on the fee structure.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Admission</th>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Grade</th>
                    <th className="py-2 pr-2 text-right">Meals billed</th>
                    <th className="py-2 pr-2 text-right">Meals balance</th>
                    <th className="py-2 pr-2 text-right">All fees due</th>
                    <th className="py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.student_id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-mono text-xs">{r.admission_number}</td>
                      <td className="py-2 pr-2 font-medium">{r.name}</td>
                      <td className="py-2 pr-2">{r.grade || "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{money(r.meals_billed)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{money(r.meals_balance)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{money(r.total_outstanding)}</td>
                      <td className="py-2">
                        <Link
                          href={`/dashboard/modules/students/${r.student_id}`}
                          className="text-primary text-xs hover:underline"
                        >
                          Profile
                        </Link>
                        {" · "}
                        <Link
                          href="/dashboard/modules/finance/payments"
                          className="text-primary text-xs hover:underline"
                        >
                          Pay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        To collect: Finance → Record payments. Partial payments leave a remaining balance on the
        invoice until cleared.
      </p>
    </div>
  );
}
