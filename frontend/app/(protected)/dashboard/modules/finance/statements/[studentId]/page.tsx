"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Printer } from "lucide-react";

export default function StudentStatementPage() {
  const params = useParams();
  const studentId = String(params.studentId || "");
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["fee-statement", studentId, schoolId],
    enabled: !!studentId && !!schoolId,
    queryFn: async () => {
      const res = await api.get(`/finance/students/${studentId}/statement/`, {
        headers: { "X-School-ID": String(schoolId) },
      });
      return res.data;
    },
  });

  const currency = data?.school?.currency || "KES";

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-3xl mx-auto print:p-0">
      <div className="flex items-center gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/modules/students/${studentId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Student
          </Link>
        </Button>
        <h1 className="text-xl font-bold flex-1">Fee statement</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading statement…</p>
      ) : (
        <Card className="print:shadow-none print:border-0">
          <CardHeader>
            <CardTitle className="text-lg">{data.school?.name}</CardTitle>
            <p className="text-sm text-muted-foreground">Student fee statement · {data.generated_at}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Student</p>
                <p className="font-semibold">{data.student?.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Admission no.</p>
                <p className="font-mono">{data.student?.admission_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Class</p>
                <p>{data.student?.class || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Invoiced</p>
                <p className="font-bold">
                  {currency} {Number(data.summary?.total_invoiced || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-bold text-emerald-700">
                  {currency} {Number(data.summary?.total_paid || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="font-bold text-amber-800">
                  {currency} {Number(data.summary?.balance || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {(data.invoices || []).map((inv: any) => (
              <div key={inv.invoice_number} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs">{inv.invoice_number}</span>
                  <span>
                    {inv.term} · {inv.academic_year}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Due {inv.due_date}</span>
                  <span>
                    Due {Number(inv.amount_due || 0).toLocaleString()} · Paid{" "}
                    {Number(inv.amount_paid || 0).toLocaleString()} · Bal{" "}
                    <strong>{Number(inv.balance || 0).toLocaleString()}</strong>
                  </span>
                </div>
                {(inv.payments || []).length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {inv.payments.map((p: any, i: number) => (
                      <li key={i}>
                        {p.paid_at ? String(p.paid_at).slice(0, 10) : ""} · {p.method} ·{" "}
                        {Number(p.amount || 0).toLocaleString()}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
