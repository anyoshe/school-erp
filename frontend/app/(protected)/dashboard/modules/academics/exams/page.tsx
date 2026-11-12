"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import { fetchAcademicYears, fetchGradeLevels, fetchSubjects } from "../services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus } from "lucide-react";

export default function ExamHallsPage() {
  const qc = useQueryClient();
  const [hallName, setHallName] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [form, setForm] = useState({
    title: "",
    academic_year: "",
    term: "",
    grade_level: "",
    subject: "",
    hall: "",
    exam_date: "",
    start_time: "08:00",
    end_time: "10:00",
  });
  const [seats, setSeats] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const hallsQ = useQuery({
    queryKey: ["exam-halls"],
    queryFn: async () => {
      const { data } = await api.get("/assessments/exam-halls/");
      return Array.isArray(data) ? data : data?.results || [];
    },
  });
  const sittingsQ = useQuery({
    queryKey: ["exam-sittings"],
    queryFn: async () => {
      const { data } = await api.get("/assessments/exam-sittings/");
      return Array.isArray(data) ? data : data?.results || [];
    },
  });
  const yearsQ = useQuery({ queryKey: ["academic-years"], queryFn: fetchAcademicYears });
  const gradesQ = useQuery({ queryKey: ["grade-levels"], queryFn: fetchGradeLevels });
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });

  const years = yearsQ.data || [];
  const activeYear = years.find((y: any) => y.is_active) || years[0];
  const terms = useMemo(() => {
    const y = years.find((x: any) => String(x.id) === form.academic_year) || activeYear;
    return y?.terms || [];
  }, [years, form.academic_year, activeYear]);

  const createHall = async () => {
    if (!hallName.trim()) return;
    try {
      await api.post("/assessments/exam-halls/", {
        name: hallName.trim(),
        capacity: Number(capacity) || 30,
      });
      toast.success("Hall created");
      setHallName("");
      qc.invalidateQueries({ queryKey: ["exam-halls"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to create hall");
    }
  };

  const createSitting = async () => {
    const payload = {
      ...form,
      academic_year: Number(form.academic_year || activeYear?.id),
      term: form.term ? Number(form.term) : null,
      grade_level: Number(form.grade_level),
      subject: form.subject,
      hall: form.hall,
    };
    if (!payload.title || !payload.grade_level || !payload.subject || !payload.hall || !payload.exam_date) {
      toast.message("Fill title, grade, subject, hall and date");
      return;
    }
    setBusy(true);
    try {
      await api.post("/assessments/exam-sittings/", payload);
      toast.success("Exam sitting scheduled");
      qc.invalidateQueries({ queryKey: ["exam-sittings"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const allocate = async (id: string) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/assessments/exam-sittings/${id}/allocate/`);
      toast.success(`Allocated ${data.allocated} seats in ${data.hall}`);
      const seatsRes = await api.get(`/assessments/exam-sittings/${id}/seats/`);
      setSeats(seatsRes.data);
      qc.invalidateQueries({ queryKey: ["exam-sittings"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Allocate failed");
    } finally {
      setBusy(false);
    }
  };

  const halls = hallsQ.data || [];
  const sittings = sittingsQ.data || [];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href="/dashboard/modules/academics" className="text-sm text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Academics
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Exam hall scheduling</h1>
        <p className="text-sm text-muted-foreground">
          Register halls, schedule sittings, and auto-allocate seat numbers for a class.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exam halls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <Label>Hall name</Label>
                <Input value={hallName} onChange={(e) => setHallName(e.target.value)} placeholder="Hall A" />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" />
              </div>
            </div>
            <Button size="sm" onClick={createHall}>
              <Plus className="h-4 w-4 mr-1" /> Add hall
            </Button>
            <ul className="text-sm divide-y rounded-lg border">
              {halls.map((h: any) => (
                <li key={h.id} className="px-3 py-2 flex justify-between">
                  <span className="font-medium">{h.name}</span>
                  <span className="text-muted-foreground">{h.capacity} seats</span>
                </li>
              ))}
              {!halls.length && <li className="px-3 py-4 text-muted-foreground">No halls yet</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule sitting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Grade 6 Math End of Term"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>Year</Label>
                <select
                  className="w-full h-9 border rounded-md px-2 text-sm"
                  value={form.academic_year || (activeYear ? String(activeYear.id) : "")}
                  onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                >
                  {(years as any[]).map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Term</Label>
                <select
                  className="w-full h-9 border rounded-md px-2 text-sm"
                  value={form.term}
                  onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                >
                  <option value="">—</option>
                  {terms.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Grade</Label>
                <select
                  className="w-full h-9 border rounded-md px-2 text-sm"
                  value={form.grade_level}
                  onChange={(e) => setForm((f) => ({ ...f, grade_level: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {(gradesQ.data || []).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Subject</Label>
                <select
                  className="w-full h-9 border rounded-md px-2 text-sm"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {(subjectsQ.data || []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Hall</Label>
                <select
                  className="w-full h-9 border rounded-md px-2 text-sm"
                  value={form.hall}
                  onChange={(e) => setForm((f) => ({ ...f, hall: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {halls.map((h: any) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.exam_date}
                  onChange={(e) => setForm((f) => ({ ...f, exam_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Start</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <Button disabled={busy} onClick={createSitting}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save sitting
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled sittings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Hall</th>
                  <th className="px-3 py-2">Seats</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sittings.map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      {s.title}
                      <div className="text-xs text-muted-foreground">
                        {s.grade_name} · {s.subject_name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.exam_date} · {s.start_time}–{s.end_time}
                    </td>
                    <td className="px-3 py-2">{s.hall_name}</td>
                    <td className="px-3 py-2 tabular-nums">{s.seat_count ?? 0}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => allocate(s.id)}>
                        Auto-allocate
                      </Button>
                    </td>
                  </tr>
                ))}
                {!sittings.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No sittings scheduled
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {seats && (
            <div>
              <h3 className="font-semibold mb-2">
                Seat list — {seats.title} ({seats.seats?.length || 0})
              </h3>
              <div className="overflow-x-auto rounded-lg border max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Seat</th>
                      <th className="px-3 py-2 text-left">Adm</th>
                      <th className="px-3 py-2 text-left">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(seats.seats || []).map((row: any) => (
                      <tr key={row.seat_label} className="border-t">
                        <td className="px-3 py-1 font-mono">{row.seat_label}</td>
                        <td className="px-3 py-1 font-mono text-xs">{row.admission_number}</td>
                        <td className="px-3 py-1">{row.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button className="mt-2" size="sm" variant="outline" onClick={() => window.print()}>
                Print seat list
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
