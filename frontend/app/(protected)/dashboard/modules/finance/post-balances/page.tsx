"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Scale } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FinanceNavLinks } from "../components/FinanceNav";

type Student = {
  id: string;
  first_name?: string;
  last_name?: string;
  admission_number?: string;
  current_class?: { name?: string } | string | null;
};

function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as any;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

function studentName(s: Student) {
  return `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.admission_number || "Student";
}

function className(s: Student) {
  const c = s.current_class;
  if (!c) return "—";
  if (typeof c === "string") return c;
  return c.name || "—";
}

export default function OpeningBalancesPage() {
  const { currentSchool } = useCurrentSchool();
  const headers = useMemo(
    () => (currentSchool?.id ? { "X-School-ID": String(currentSchool.id) } : undefined),
    [currentSchool?.id]
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [term, setTerm] = useState("Opening");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/students/", { headers, params: { page_size: 500 } });
      setStudents(asList(res.data));
    } catch {
      toast.error("Could not load students");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const filtered = useMemo(() => {
    const termQ = q.trim().toLowerCase();
    if (!termQ) return students.slice(0, 80);
    return students
      .filter((s) =>
        `${studentName(s)} ${s.admission_number || ""} ${className(s)}`
          .toLowerCase()
          .includes(termQ)
      )
      .slice(0, 80);
  }, [students, q]);

  const submit = async () => {
    if (!studentId) return toast.error("Select a student");
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a valid amount");
    setSubmitting(true);
    try {
      const { data } = await api.post(
        "/finance/opening-balances/",
        {
          student_id: studentId,
          amount: n,
          academic_year: academicYear,
          term,
          due_date: dueDate || undefined,
          notes,
        },
        { headers }
      );
      toast.success(`Opening balance posted · ${data.invoice_number || "invoice created"}`);
      setRecent((prev) => [data, ...prev].slice(0, 8));
      setAmount("");
      setNotes("");
      setStudentId("");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to post opening balance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-5xl mx-auto">
      <FinanceNavLinks />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="h-6 w-6 text-violet-700" /> Opening balances
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Record arrears from paper books or another system as a proper invoice. Use this when a
          learner joins mid-stream or migrates in with a balance — not for day-to-day fee payments
          (use Payments).
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New opening balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Search student</Label>
              <Input
                className="mt-1"
                placeholder="Name or admission number"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
              {loading ? (
                <p className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : filtered.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No students match.</p>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStudentId(s.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${
                      studentId === s.id ? "bg-violet-50" : ""
                    }`}
                  >
                    <span className="font-medium">{studentName(s)}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {s.admission_number || "—"} · {className(s)}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount *</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-xs">Due date</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Academic year</Label>
                <Input
                  className="mt-1"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2026"
                />
              </div>
              <div>
                <Label className="text-xs">Term / label</Label>
                <Input
                  className="mt-1"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Opening / Term 1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Balance from previous school / paper ledger"
              />
            </div>
            <Button
              className="w-full bg-violet-700 hover:bg-violet-800"
              disabled={submitting || !studentId}
              onClick={submit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Post opening balance
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">This session</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Posted opening balances will appear here. Collect them later under Payments.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recent.map((r, i) => (
                  <li key={i} className="rounded-lg border px-3 py-2">
                    <p className="font-medium">{r.invoice_number}</p>
                    <p className="text-muted-foreground text-xs">
                      Amount {Number(r.amount || 0).toLocaleString()} · {r.term} {r.academic_year}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
