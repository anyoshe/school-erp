"use client";

import { SchoolPrintHeader } from "@/components/print/SchoolPrintHeader";
import { useState } from "react";
import Link from "next/link";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export default function TranscriptPage() {
  const [admission, setAdmission] = useState("");
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<any>(null);

  const load = async () => {
    setBusy(true);
    try {
      let sid = studentId.trim();
      if (!sid && admission.trim()) {
        const { data } = await api.get("/students/", {
          params: { search: admission.trim() },
        });
        const list = Array.isArray(data) ? data : data?.results || [];
        const match = list.find(
          (s: any) =>
            String(s.admission_number || "").toLowerCase() === admission.trim().toLowerCase()
        ) || list[0];
        if (!match) {
          toast.error("Student not found");
          setBusy(false);
          return;
        }
        sid = match.id;
        setStudentId(sid);
      }
      if (!sid) {
        toast.message("Enter admission number or student id");
        setBusy(false);
        return;
      }
      const { data } = await api.get("/assessments/transcript/", { params: { student: sid } });
      setDoc(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not load transcript");
      setDoc(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 print:hidden">
        <Link href="/dashboard/modules/academics" className="text-sm text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Academics
        </Link>
      </div>
      <div className="print:hidden space-y-3">
        <h1 className="text-2xl font-bold">Official academic transcript</h1>
        <p className="text-sm text-muted-foreground">
          Ministry-style cumulative record across all terms with marks on file.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Admission number</Label>
            <Input value={admission} onChange={(e) => setAdmission(e.target.value)} placeholder="PSS-2026-0001" />
          </div>
          <div>
            <Label>Or student ID</Label>
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="UUID" />
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={load}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Generate
            </Button>
            {doc && (
              <Button variant="outline" onClick={() => window.print()}>
                Print
              </Button>
            )}
          </div>
        </div>
      </div>

      {doc && (
        <Card className="print-document border-2 border-slate-800 print:border-black">
          <CardContent className="p-6 sm:p-8 space-y-6 text-sm">
            <SchoolPrintHeader
              school={doc.school}
              documentTitle={doc.document || "Official Academic Transcript"}
              subtitle={doc.issued_at ? `Issued: ${doc.issued_at}` : null}
            />

            <div className="grid sm:grid-cols-2 gap-2">
              <p><span className="text-muted-foreground">Learner:</span> <strong>{doc.student?.full_name}</strong></p>
              <p><span className="text-muted-foreground">Admission No:</span> <strong>{doc.student?.admission_number}</strong></p>
              <p><span className="text-muted-foreground">Date of birth:</span> {doc.student?.date_of_birth || "—"}</p>
              <p><span className="text-muted-foreground">Current grade:</span> {doc.student?.current_grade || "—"}</p>
            </div>

            {(doc.terms || []).map((t: any, idx: number) => (
              <div key={idx} className="space-y-2 break-inside-avoid">
                <h3 className="font-semibold border-b pb-1">
                  {t.academic_year?.name} · {t.term?.name}
                  {t.overall_average != null ? ` — Avg ${t.overall_average}% (${t.overall_grade || "—"})` : ""}
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-1">Subject</th>
                      <th className="py-1">Teacher</th>
                      <th className="py-1 text-right">Average %</th>
                      <th className="py-1 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(t.subjects || []).map((s: any) => (
                      <tr key={s.subject_id} className="border-b border-dashed">
                        <td className="py-1">{s.subject_name}</td>
                        <td className="py-1 text-muted-foreground whitespace-nowrap">{s.teacher_name || "—"}</td>
                        <td className="py-1 text-right tabular-nums">{s.average ?? "—"}</td>
                        <td className="py-1 text-center">{s.grade_letter || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div className="border-t pt-4 flex flex-wrap justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Cumulative average</p>
                <p className="text-2xl font-bold">
                  {doc.cumulative_average != null ? `${doc.cumulative_average}%` : "—"}{" "}
                  <span className="text-base text-primary">{doc.cumulative_grade || ""}</span>
                </p>
              </div>
              <div className="max-w-md text-xs leading-relaxed">
                <p className="italic">{doc.certification}</p>
                <div className="mt-8 grid grid-cols-2 gap-8">
                  <div>
                    <div className="border-b border-slate-400 h-8" />
                    <p className="mt-1">Principal / Head teacher</p>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 h-8" />
                    <p className="mt-1">School stamp / date</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
