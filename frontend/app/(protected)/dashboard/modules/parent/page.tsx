"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GraduationCap, User } from "lucide-react";

type Child = {
  id: string;
  admission_number: string;
  full_name: string;
  grade?: string | null;
  section?: string | null;
  status?: string;
};

export default function ParentPortalPage() {
  const { currentSchool } = useCurrentSchool();
  const [selected, setSelected] = useState<string>("");

  const childrenQ = useQuery({
    queryKey: ["parent-children", currentSchool?.id],
    queryFn: async () => {
      const { data } = await api.get("/parent-portal/children/");
      return data as { children: Child[]; guardian?: string; detail?: string };
    },
    enabled: !!currentSchool?.id,
  });

  const children = childrenQ.data?.children || [];
  useEffect(() => {
    if (!selected && children[0]) setSelected(children[0].id);
  }, [children, selected]);

  const resultsQ = useQuery({
    queryKey: ["parent-results", selected],
    queryFn: async () => {
      const { data } = await api.get(`/parent-portal/children/${selected}/results/`);
      return data;
    },
    enabled: !!selected,
  });

  const card = resultsQ.data;

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Parent portal</p>
        <h1 className="text-2xl font-bold">Results for your children</h1>
        <p className="text-sm text-muted-foreground">
          {currentSchool?.name || "Your school"} · term report snapshot
        </p>
      </div>

      {childrenQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : children.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {childrenQ.data?.detail ||
              "No learners linked yet. Ask the school office to link your parent account to your child’s admission number."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
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

          {resultsQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
            </div>
          ) : card ? (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  {card.student?.full_name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {card.grade?.name} · {card.term?.name || "Term"} ·{" "}
                  {card.academic_year?.name || "Year"}
                  {card.position != null ? ` · Position ${card.position}/${card.out_of}` : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Overall average</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {card.overall_average != null ? `${Number(card.overall_average).toFixed(1)} / 100` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Overall grade</p>
                    <p className="text-2xl font-bold text-primary">{card.overall_grade || "—"}</p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Teacher</th>
                        <th className="px-3 py-2 text-right">Avg / 100</th>
                        <th className="px-3 py-2 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(card.subjects || []).map((s: any) => (
                        <tr key={s.subject_id} className="border-t">
                          <td className="px-3 py-2 font-medium">{s.subject_name}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {s.teacher_name || "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {s.average != null ? `${Number(s.average).toFixed(1)} / 100` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-primary">
                            {s.grade_letter || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  Print results
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
