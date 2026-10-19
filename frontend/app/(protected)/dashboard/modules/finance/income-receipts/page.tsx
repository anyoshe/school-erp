"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function IncomeReceiptsPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["income-receipts", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/income-receipts/", {
        headers: { "X-School-ID": String(schoolId) },
      });
      return asList(res.data);
    },
  });

  const rows = data || [];

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Pre-enrollment income</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Interview and admission fees posted from the admissions pipeline (separate from term school fees).
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income receipts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interview/admission receipts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {r.paid_at ? String(r.paid_at).slice(0, 10) : "—"}
                      </td>
                      <td className="py-2 pr-3">{r.source}</td>
                      <td className="py-2 pr-3 font-medium">
                        {Number(r.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">{r.payment_method || "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{r.reference_number || "—"}</td>
                      <td className="py-2 text-muted-foreground">{r.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
