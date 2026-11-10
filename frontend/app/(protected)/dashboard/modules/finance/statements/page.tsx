"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ScrollText } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function nameOf(s: Student) {
  return `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.admission_number || "Student";
}

function classOf(s: Student) {
  const c = s.current_class;
  if (!c) return "—";
  if (typeof c === "string") return c;
  return c.name || "—";
}

export default function StatementsIndexPage() {
  const { currentSchool } = useCurrentSchool();
  const headers = useMemo(
    () => (currentSchool?.id ? { "X-School-ID": String(currentSchool.id) } : undefined),
    [currentSchool?.id]
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
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
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students.slice(0, 100);
    return students
      .filter((s) =>
        `${nameOf(s)} ${s.admission_number || ""} ${classOf(s)}`.toLowerCase().includes(t)
      )
      .slice(0, 100);
  }, [students, q]);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto">
      <FinanceNavLinks />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-sky-700" /> Student statements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Open a printable ledger of billed vs paid for any learner.
        </p>
      </div>

      <Card className="rounded-2xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Find learner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search name or admission number"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-[28rem] overflow-y-auto rounded-xl border divide-y">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No match.</p>
            ) : (
              filtered.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{nameOf(s)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.admission_number || "—"} · {classOf(s)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/modules/finance/statements/${s.id}`}>
                      View statement
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
