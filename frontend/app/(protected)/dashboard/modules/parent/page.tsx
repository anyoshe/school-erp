"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";
import { ParentAcademicReport } from "@/components/print/ParentAcademicReport";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  GraduationCap,
  User,
  Wallet,
  CalendarDays,
  BookOpen,
  AlertCircle,
} from "lucide-react";

type Child = {
  id: string;
  admission_number: string;
  full_name: string;
  grade?: string | null;
  section?: string | null;
  status?: string;
  fee_balance?: string;
  open_invoices?: number;
  recent_absences?: number;
  attendance_rate?: number | null;
};

type Tab = "overview" | "fees" | "results" | "attendance";

function money(v?: string | number | null) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "—";
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function ParentPortalPage() {
  const { currentSchool } = useCurrentSchool();
  const [selected, setSelected] = useState<string>("");
  const [tab, setTab] = useState<Tab>("overview");

  const childrenQ = useQuery({
    queryKey: ["parent-children", currentSchool?.id],
    queryFn: async () => {
      const { data } = await api.get("/parent-portal/children/");
      return data as { children: Child[]; guardian?: string; detail?: string };
    },
    enabled: !!currentSchool?.id,
  });

  const digestQ = useQuery({
    queryKey: ["parent-digest", currentSchool?.id],
    queryFn: async () => {
      const { data } = await api.get("/parent-portal/digest/");
      return data as { items: { type: string; severity: string; title: string; detail: string; student_id: string }[]; count: number };
    },
    enabled: !!currentSchool?.id,
  });

  const children = childrenQ.data?.children || [];
  useEffect(() => {
    if (!selected && children[0]) setSelected(children[0].id);
  }, [children, selected]);

  const activeChild = useMemo(
    () => children.find((c) => c.id === selected) || null,
    [children, selected]
  );

  const overviewQ = useQuery({
    queryKey: ["parent-overview", selected],
    queryFn: async () => {
      const { data } = await api.get(`/parent-portal/children/${selected}/overview/`);
      return data;
    },
    enabled: !!selected && tab === "overview",
  });

  const feesQ = useQuery({
    queryKey: ["parent-fees", selected],
    queryFn: async () => {
      const { data } = await api.get(`/parent-portal/children/${selected}/fees/`);
      return data;
    },
    enabled: !!selected && tab === "fees",
  });

  const resultsQ = useQuery({
    queryKey: ["parent-results", selected],
    queryFn: async () => {
      const { data } = await api.get(`/parent-portal/children/${selected}/results/`);
      return data;
    },
    enabled: !!selected && tab === "results",
  });

  const attendanceQ = useQuery({
    queryKey: ["parent-attendance", selected],
    queryFn: async () => {
      const { data } = await api.get(`/parent-portal/children/${selected}/attendance/`, {
        params: { days: 60 },
      });
      return data;
    },
    enabled: !!selected && tab === "attendance",
  });

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <User className="h-3.5 w-3.5" /> },
    { id: "fees", label: "Fees", icon: <Wallet className="h-3.5 w-3.5" /> },
    { id: "results", label: "Results", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: "attendance", label: "Attendance", icon: <CalendarDays className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Parent portal</p>
        <h1 className="text-2xl font-bold">Your children</h1>
        <p className="text-sm text-muted-foreground">
          {currentSchool?.name || "Your school"}
          {childrenQ.data?.guardian ? ` · ${childrenQ.data.guardian}` : ""}
        </p>
      </div>

      {childrenQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : children.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              {childrenQ.data?.detail ||
                "No learners linked yet. Ask the school office to open Parent Portal and invite/link your email to the child’s admission number. Then sign out and sign in again."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div {(digestQ.data?.items?.length ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm rounded-xl">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-4 w-4" /> Needs your attention
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 space-y-2">
            {digestQ.data!.items.slice(0, 5).map((it, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm hover:bg-amber-50/50"
                onClick={() => {
                  setSelected(it.student_id);
                  setTab(it.type === "fee" ? "fees" : it.type === "attendance" ? "attendance" : "overview");
                }}
              >
                <span className="font-medium block">{it.title}</span>
                <span className="text-xs text-muted-foreground">{it.detail}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelected(c.id);
                  setTab("overview");
                }}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  selected === c.id
                    ? "bg-primary text-white border-primary"
                    : "bg-white hover:border-primary/40"
                }`}
              >
                <User className="inline h-3.5 w-3.5 mr-1" />
                {c.full_name}
                <span className="opacity-70 text-xs ml-1">({c.admission_number})</span>
              </button>
            ))}
          </div>

          {activeChild && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card className="shadow-sm">
                <CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground">Grade</p>
                  <p className="font-semibold text-sm">
                    {activeChild.grade || "—"}
                    {activeChild.section ? ` · ${activeChild.section}` : ""}
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground">Fee balance</p>
                  <p className="font-semibold text-sm tabular-nums">{money(activeChild.fee_balance)}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground">Open invoices</p>
                  <p className="font-semibold text-sm">{activeChild.open_invoices ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground">Attendance (14d)</p>
                  <p className="font-semibold text-sm">
                    {activeChild.attendance_rate != null
                      ? `${activeChild.attendance_rate}%`
                      : "—"}
                    {activeChild.recent_absences
                      ? ` · ${activeChild.recent_absences} absent`
                      : ""}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex flex-wrap gap-1 border-b pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
                  tab === t.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <>
              {overviewQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading overview…
                </div>
              ) : overviewQ.data ? (
                <div className="grid md:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" /> Fees
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Invoiced</span>
                        <span className="tabular-nums">{money(overviewQ.data.fees?.total_invoiced)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid</span>
                        <span className="tabular-nums">{money(overviewQ.data.fees?.total_paid)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Balance</span>
                        <span className="tabular-nums">{money(overviewQ.data.fees?.balance)}</span>
                      </div>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setTab("fees")}>
                        View statements
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" /> Attendance (30 days)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Present</span>
                        <span>{overviewQ.data.attendance?.present ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Absent</span>
                        <span>{overviewQ.data.attendance?.absent ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Late</span>
                        <span>{overviewQ.data.attendance?.late ?? 0}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Rate</span>
                        <span>
                          {overviewQ.data.attendance?.attendance_rate != null
                            ? `${overviewQ.data.attendance.attendance_rate}%`
                            : "—"}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setTab("attendance")}
                      >
                        Full attendance
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-primary" /> Latest results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {overviewQ.data.results_preview ? (
                        <div className="flex flex-wrap gap-4 items-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Average</p>
                            <p className="font-semibold text-lg">
                              {overviewQ.data.results_preview.overall_average != null
                                ? `${overviewQ.data.results_preview.overall_average}%`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Position</p>
                            <p className="font-semibold">
                              {overviewQ.data.results_preview.position != null
                                ? `${overviewQ.data.results_preview.position}${
                                    overviewQ.data.results_preview.out_of
                                      ? ` / ${overviewQ.data.results_preview.out_of}`
                                      : ""
                                  }`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Grade</p>
                            <p className="text-lg font-bold">
                              {overviewQ.data.results_preview.overall_grade ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Subjects</p>
                            <p className="font-semibold">
                              {overviewQ.data.results_preview.subject_count ?? 0}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setTab("results")}>
                            Open report
                          </Button>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No published marks for the current term yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </>
          )}

          {tab === "fees" && (
            <>
              {feesQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading fees…
                </div>
              ) : feesQ.data ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Card>
                      <CardContent className="p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Invoiced</p>
                        <p className="font-semibold tabular-nums">
                          {money(feesQ.data.summary?.total_invoiced)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Paid</p>
                        <p className="font-semibold tabular-nums">
                          {money(feesQ.data.summary?.total_paid)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="font-semibold tabular-nums">
                          {money(feesQ.data.summary?.balance)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Invoices</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      {(feesQ.data.invoices || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No invoices yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b">
                              <th className="py-2 pr-2">Invoice</th>
                              <th className="py-2 pr-2">Term</th>
                              <th className="py-2 pr-2 text-right">Due</th>
                              <th className="py-2 pr-2 text-right">Paid</th>
                              <th className="py-2 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feesQ.data.invoices.map((inv: any) => (
                              <tr key={inv.id} className="border-b last:border-0">
                                <td className="py-2 pr-2 font-medium">{inv.invoice_number}</td>
                                <td className="py-2 pr-2">{inv.term || "—"}</td>
                                <td className="py-2 pr-2 text-right tabular-nums">
                                  {money(inv.amount_due)}
                                </td>
                                <td className="py-2 pr-2 text-right tabular-nums">
                                  {money(inv.amount_paid)}
                                </td>
                                <td className="py-2 text-right tabular-nums font-medium">
                                  {money(inv.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Payment history</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      {(feesQ.data.payments || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No payments recorded.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b">
                              <th className="py-2 pr-2">Date</th>
                              <th className="py-2 pr-2">Receipt</th>
                              <th className="py-2 pr-2">Method</th>
                              <th className="py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feesQ.data.payments.map((p: any) => (
                              <tr key={p.id} className="border-b last:border-0">
                                <td className="py-2 pr-2">
                                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                                </td>
                                <td className="py-2 pr-2">{p.receipt_number || p.invoice_number || "—"}</td>
                                <td className="py-2 pr-2">{p.method || "—"}</td>
                                <td className="py-2 text-right tabular-nums font-medium">
                                  {money(p.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </>
          )}

          {tab === "results" && (
            <>
              {resultsQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
                </div>
              ) : resultsQ.isError ? (
                <p className="text-sm text-rose-600">Could not load results for this term.</p>
              ) : !resultsQ.data ? (
                <p className="text-sm text-muted-foreground">No results available yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                    <p className="text-xs text-muted-foreground">
                      A4 layout — use Print report for a clean one-page official copy.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      Print report
                    </Button>
                  </div>
                  <ParentAcademicReport
                    data={resultsQ.data}
                    learnerName={activeChild?.full_name}
                    admissionNumber={activeChild?.admission_number}
                    gradeLabel={activeChild?.grade}
                    sectionLabel={activeChild?.section}
                  />
                </div>
              )}
            </>
          )}

          {tab === "attendance" && (
            <>
              {attendanceQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance…
                </div>
              ) : attendanceQ.data ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      ["Present", attendanceQ.data.summary?.present],
                      ["Absent", attendanceQ.data.summary?.absent],
                      ["Late", attendanceQ.data.summary?.late],
                      ["Excused", attendanceQ.data.summary?.excused],
                      [
                        "Rate",
                        attendanceQ.data.summary?.attendance_rate != null
                          ? `${attendanceQ.data.summary.attendance_rate}%`
                          : "—",
                      ],
                    ].map(([label, val]) => (
                      <Card key={String(label)}>
                        <CardContent className="p-3 text-sm">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-semibold">{val ?? 0}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Recent records</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      {(attendanceQ.data.records || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No attendance marked in this period.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b">
                              <th className="py-2 pr-2">Date</th>
                              <th className="py-2 pr-2">Status</th>
                              <th className="py-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceQ.data.records.map((r: any, i: number) => (
                              <tr key={`${r.date}-${i}`} className="border-b last:border-0">
                                <td className="py-2 pr-2 whitespace-nowrap">
                                  {new Date(r.date).toLocaleDateString()}
                                </td>
                                <td className="py-2 pr-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                      r.status === "PRESENT"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : r.status === "ABSENT"
                                          ? "bg-rose-50 text-rose-700"
                                          : r.status === "LATE"
                                            ? "bg-amber-50 text-amber-700"
                                            : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2 text-muted-foreground">{r.notes || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
