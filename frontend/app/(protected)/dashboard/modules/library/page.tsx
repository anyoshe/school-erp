"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, Library, Search, Plus, RotateCcw, Package, LayoutDashboard,
  FileText, Settings, Loader2, AlertCircle, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";

type Tab =
  | "dashboard"
  | "catalogue"
  | "copies"
  | "issue"
  | "returns"
  | "overdue"
  | "allocations"
  | "stocktake"
  | "digital"
  | "assignments"
  | "reader"
  | "settings";

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "catalogue", label: "Catalogue", icon: BookOpen },
  { id: "copies", label: "Copies", icon: Package },
  { id: "issue", label: "Issue", icon: Library },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "overdue", label: "Overdue", icon: AlertCircle },
  { id: "allocations", label: "Class books", icon: Users },
  { id: "stocktake", label: "Stocktake", icon: Search },
  { id: "digital", label: "Digital", icon: FileText },
  { id: "assignments", label: "Assignments", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const o = data as { results?: T[]; data?: T[] };
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

function AssignForm({ digital, students, headers, onDone }: any) {
  const [resource, setResource] = useState("");
  const [studentId, setStudentId] = useState("");
  const [grade, setGrade] = useState("");
  const [due, setDue] = useState("");
  const [instructions, setInstructions] = useState("");
  return (
    <div className="space-y-3">
      <div>
        <Label>Approved resource</Label>
        <Select value={resource} onValueChange={setResource}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {digital.map((d: any) => (
              <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Learner (optional)</Label>
        <Select value={studentId || "none"} onValueChange={(v) => setStudentId(v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Class-level only</SelectItem>
            {students.slice(0, 200).map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.admission_number} — {s.first_name} {s.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Grade label</Label>
        <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade 4" />
      </div>
      <div>
        <Label>Due date</Label>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <div>
        <Label>Instructions</Label>
        <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <Button
        className="w-full"
        onClick={async () => {
          if (!resource) return toast.error("Select resource");
          try {
            await api.post("/library/assignments/", {
              resource,
              student: studentId || null,
              grade_label: grade,
              due_date: due || null,
              instructions,
            }, { headers });
            toast.success("Assigned");
            onDone?.();
          } catch (e: any) {
            toast.error(e?.response?.data?.detail || "Assign failed");
          }
        }}
      >
        Create assignment
      </Button>
    </div>
  );
}

export default function LibraryPage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;

  const [tab, setTab] = useState<Tab>("dashboard");
  const [dash, setDash] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [copies, setCopies] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [digital, setDigital] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // forms
  const [bookForm, setBookForm] = useState({ title: "", author: "", category: "TEXTBOOK", subject: "", grade_levels: "" });
  const [regForm, setRegForm] = useState({ book_id: "", count: "1", accession_prefix: "ACC" });
  const [issueForm, setIssueForm] = useState({ copy_id: "", student_id: "", remarks: "" });
  const [students, setStudents] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [allocForm, setAllocForm] = useState({
    book_id: "", grade_label: "", academic_year: "", term: "", name: "", student_ids: [] as string[],
  });
  const [stockForm, setStockForm] = useState({ name: "", location_filter: "", accession: "", stocktake_id: "" });
  const [digForm, setDigForm] = useState({ title: "", subject: "", grade_levels: "", external_url: "", resource_type: "PDF" });
  const [digFile, setDigFile] = useState<File | null>(null);
  const [readerId, setReaderId] = useState<string>("");
  const [readerUrl, setReaderUrl] = useState<string>("");
  const [readerTitle, setReaderTitle] = useState("");
  const [assignments, setAssignments] = useState<any[]>([]);



  const loadDashboard = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await api.get("/library/dashboard/", { headers });
    setDash(data);
  }, [schoolId]);

  const loadBooks = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await api.get("/library/books/", { headers, params: { q: q || undefined } });
    setBooks(asList(data));
  }, [schoolId, q]);

  const loadCopies = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await api.get("/library/copies/", { headers, params: { q: q || undefined } });
    setCopies(asList(data));
  }, [schoolId, q]);

  const loadLoans = useCallback(async (overdue = false) => {
    if (!schoolId) return;
    const { data } = await api.get("/library/borrowings/", {
      headers,
      params: overdue ? { overdue: "1" } : { status: "ACTIVE" },
    });
    setLoans(asList(data));
  }, [schoolId]);

  const loadDigital = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await api.get("/library/digital/", { headers });
    setDigital(asList(data));
  }, [schoolId]);

  const openReader = async (id: string, title: string) => {
    try {
      const res = await api.get(`/library/digital/${id}/file/`, {
        headers,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (readerUrl) URL.revokeObjectURL(readerUrl);
      setReaderUrl(url);
      setReaderId(id);
      setReaderTitle(title);
      setTab("digital");
      try {
        await api.post(`/library/digital/${id}/progress/`, { page: "1" }, { headers });
      } catch { /* optional */ }
    } catch {
      toast.error("Unable to open resource (permission or missing file)");
    }
  };

  const loadSettings = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await api.get("/library/settings/", { headers });
    setSettings(data);
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    const run = async () => {
      try {
        if (tab === "dashboard") await loadDashboard();
        if (tab === "catalogue") await loadBooks();
        if (tab === "copies" || tab === "issue") {
          await loadCopies();
          await loadBooks();
          if (tab === "issue") {
            try {
              const { data } = await api.get("/students/", { headers });
              setStudents(asList(data));
            } catch { setStudents([]); }
          }
        }
        if (tab === "returns") await loadLoans(false);
        if (tab === "overdue") await loadLoans(true);
        if (tab === "digital") await loadDigital();
        if (tab === "settings") await loadSettings();
        if (tab === "allocations") {
          await loadBooks();
          try {
            const { data } = await api.get("/library/class-allocations/", { headers });
            setAllocations(asList(data));
          } catch { setAllocations([]); }
          try {
            const { data } = await api.get("/students/", { headers });
            setStudents(asList(data));
          } catch { setStudents([]); }
        }
        if (tab === "stocktake") {
          try {
            const { data } = await api.get("/library/stocktakes/", { headers });
            setStocktakes(asList(data));
          } catch { setStocktakes([]); }
        }
        if (tab === "assignments") {
          await loadDigital();
          try {
            const { data } = await api.get("/library/assignments/", { headers });
            setAssignments(asList(data));
          } catch { setAssignments([]); }
          try {
            const { data } = await api.get("/students/", { headers });
            setStudents(asList(data));
          } catch { setStudents([]); }
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load library data");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [tab, schoolId, loadDashboard, loadBooks, loadCopies, loadLoans, loadDigital, loadSettings]);

  const createBook = async () => {
    if (!bookForm.title.trim()) return toast.error("Title required");
    try {
      await api.post("/library/books/", bookForm, { headers });
      toast.success("Book title saved");
      setBookForm({ title: "", author: "", category: "TEXTBOOK", subject: "", grade_levels: "" });
      await loadBooks();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const registerCopies = async () => {
    if (!regForm.book_id) return toast.error("Select a book");
    try {
      await api.post("/library/books/register-copies/", {
        book_id: regForm.book_id,
        count: Number(regForm.count) || 1,
        accession_prefix: regForm.accession_prefix || "ACC",
      }, { headers });
      toast.success("Copies registered");
      await loadCopies();
      await loadBooks();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || "Failed");
    }
  };

  const issueBook = async () => {
    if (!issueForm.copy_id) return toast.error("Select a copy");
    try {
      await api.post("/library/borrowings/issue/", {
        copy_id: issueForm.copy_id,
        student_id: issueForm.student_id || null,
        remarks: issueForm.remarks,
      }, { headers });
      toast.success("Book issued");
      setIssueForm({ copy_id: "", student_id: "", remarks: "" });
      await loadCopies();
    } catch (e: any) {
      const d = e?.response?.data;
      toast.error(typeof d === "string" ? d : d?.detail || d?.non_field_errors?.[0] || "Issue failed");
    }
  };

  const returnLoan = async (id: string) => {
    try {
      await api.post(`/library/borrowings/${id}/return_loan/`, {}, { headers });
      toast.success("Returned");
      await loadLoans(tab === "overdue");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Return failed");
    }
  };

  const saveSettings = async () => {
    try {
      await api.patch("/library/settings/", settings, { headers });
      toast.success("Settings saved");
    } catch {
      toast.error("Could not save settings");
    }
  };

  const availableCopies = useMemo(
    () => copies.filter((c) => c.status === "AVAILABLE"),
    [copies]
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Library className="h-7 w-7 text-primary" /> Library Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Physical catalogue, copies, lending — and digital resources.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium touch-manipulation ${
              tab === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}

      {tab === "dashboard" && dash && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Titles", value: dash.physical?.titles },
            { label: "Copies", value: dash.physical?.copies_total },
            { label: "Available", value: dash.physical?.copies_available },
            { label: "Issued", value: dash.physical?.copies_issued },
            { label: "Overdue", value: dash.physical?.overdue_loans },
            { label: "Lost/Damaged", value: dash.physical?.lost_damaged },
            { label: "Digital resources", value: dash.digital?.total },
            { label: "Pending approval", value: dash.digital?.pending },
          ].map((s) => (
            <Card key={s.label} className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold tabular-nums">{s.value ?? 0}</p>
              </CardContent>
            </Card>
          ))}
          <Card className="sm:col-span-2 lg:col-span-4 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent loans</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {(dash.recent_loans || []).length === 0 && (
                  <li className="p-4 text-sm text-muted-foreground">No loans yet.</li>
                )}
                {(dash.recent_loans || []).map((l: any) => (
                  <li key={l.id} className="px-4 py-2 text-sm flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{l.book_title}</span>
                    <span className="text-muted-foreground">
                      {l.student_name || l.staff_name || "Borrower"} · {l.status} · due {l.due_date || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "catalogue" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1 shadow-sm">
            <CardHeader><CardTitle className="text-base">Add title</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Title *</Label>
                <Input value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
              </div>
              <div>
                <Label>Author</Label>
                <Input value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} />
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={bookForm.subject} onChange={(e) => setBookForm({ ...bookForm, subject: e.target.value })} />
              </div>
              <div>
                <Label>Grades (e.g. 4,5 or Grade 4)</Label>
                <Input value={bookForm.grade_levels} onChange={(e) => setBookForm({ ...bookForm, grade_levels: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={bookForm.category} onValueChange={(v) => setBookForm({ ...bookForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["TEXTBOOK", "REFERENCE", "STORYBOOK", "DICTIONARY", "REVISION", "TEACHER_REF", "OTHER"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={createBook}><Plus className="h-4 w-4 mr-1" /> Save title</Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-2">
              <CardTitle className="text-base flex-1">Book catalogue</CardTitle>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => loadBooks()} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                      <th className="p-3">Title</th>
                      <th className="p-3">Author</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Copies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((b) => (
                      <tr key={b.id} className="border-b">
                        <td className="p-3 font-medium">{b.title}</td>
                        <td className="p-3">{b.author || "—"}</td>
                        <td className="p-3">{b.category}</td>
                        <td className="p-3 text-right tabular-nums">
                          {b.copies_available ?? 0}/{b.copies_total ?? 0}
                        </td>
                      </tr>
                    ))}
                    {books.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-muted-foreground text-center">No titles yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "copies" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Register copies</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Book title</Label>
                <Select value={regForm.book_id} onValueChange={(v) => setRegForm({ ...regForm, book_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select book" /></SelectTrigger>
                  <SelectContent>
                    {books.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>How many copies</Label>
                <Input type="number" min={1} value={regForm.count} onChange={(e) => setRegForm({ ...regForm, count: e.target.value })} />
              </div>
              <div>
                <Label>Accession prefix</Label>
                <Input value={regForm.accession_prefix} onChange={(e) => setRegForm({ ...regForm, accession_prefix: e.target.value })} />
              </div>
              <Button className="w-full" onClick={registerCopies}>Register copies</Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Individual copies</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                      <th className="p-3">Accession</th>
                      <th className="p-3">Title</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {copies.map((c) => (
                      <tr key={c.id} className="border-b">
                        <td className="p-3 font-mono text-xs">{c.accession_number}</td>
                        <td className="p-3">{c.book_title}</td>
                        <td className="p-3">{c.status}</td>
                        <td className="p-3">{c.storage_location || "—"}</td>
                      </tr>
                    ))}
                    {copies.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No copies registered.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "issue" && (
        <Card className="max-w-lg">
          <CardHeader><CardTitle className="text-base">Issue book</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Available copy</Label>
              <Select value={issueForm.copy_id} onValueChange={(v) => setIssueForm({ ...issueForm, copy_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select copy" /></SelectTrigger>
                <SelectContent>
                  {availableCopies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.accession_number} — {c.book_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Student (optional if issuing to account user)</Label>
              <Select value={issueForm.student_id || "none"} onValueChange={(v) => setIssueForm({ ...issueForm, student_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Current user / none —</SelectItem>
                  {students.slice(0, 200).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.admission_number} — {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Remarks</Label>
              <Input value={issueForm.remarks} onChange={(e) => setIssueForm({ ...issueForm, remarks: e.target.value })} />
            </div>
            <Button className="w-full" onClick={issueBook}>Issue book</Button>
            <p className="text-xs text-muted-foreground">
              System blocks issuing copies that are already out, lost, or damaged.
            </p>
          </CardContent>
        </Card>
      )}

      {(tab === "returns" || tab === "overdue") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tab === "overdue" ? "Overdue loans" : "Active loans — return"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {loans.map((l) => (
                <li key={l.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div>
                    <p className="font-medium text-sm">{l.book_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.accession_number || "—"} · {l.student_name || l.staff_name || "Borrower"} · due {l.due_date || "—"} · {l.status}
                    </p>
                  </div>
                  {l.status !== "RETURNED" && (
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => returnLoan(l.id)}>
                      Return
                    </Button>
                  )}
                </li>
              ))}
              {loans.length === 0 && (
                <li className="p-6 text-sm text-muted-foreground text-center">No loans in this list.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {tab === "digital" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload / register resource</CardTitle>
              <p className="text-xs text-muted-foreground">Saves as pending until a librarian approves.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Title *</Label>
                <Input value={digForm.title} onChange={(e) => setDigForm({ ...digForm, title: e.target.value })} />
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={digForm.subject} onChange={(e) => setDigForm({ ...digForm, subject: e.target.value })} />
              </div>
              <div>
                <Label>Grades</Label>
                <Input value={digForm.grade_levels} onChange={(e) => setDigForm({ ...digForm, grade_levels: e.target.value })} placeholder="4,5" />
              </div>
              <div>
                <Label>External URL (optional)</Label>
                <Input value={digForm.external_url} onChange={(e) => setDigForm({ ...digForm, external_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>File (PDF/EPUB/image/audio)</Label>
                <Input type="file" onChange={(e) => setDigFile(e.target.files?.[0] || null)} />
              </div>
              <Button
                className="w-full"
                onClick={async () => {
                  if (!digForm.title.trim()) return toast.error("Title required");
                  try {
                    const fd = new FormData();
                    fd.append("title", digForm.title);
                    fd.append("subject", digForm.subject);
                    fd.append("grade_levels", digForm.grade_levels);
                    fd.append("resource_type", digForm.resource_type);
                    if (digForm.external_url) fd.append("external_url", digForm.external_url);
                    if (digFile) fd.append("file", digFile);
                    await api.post("/library/digital/", fd, {
                      headers: { ...headers, "Content-Type": "multipart/form-data" },
                    });
                    toast.success("Uploaded — pending approval");
                    setDigForm({ title: "", subject: "", grade_levels: "", external_url: "", resource_type: "PDF" });
                    setDigFile(null);
                    await loadDigital();
                  } catch (e: any) {
                    toast.error(e?.response?.data?.detail || "Upload failed");
                  }
                }}
              >
                Submit for approval
              </Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Digital catalogue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {digital.map((d) => (
                  <li key={d.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.resource_type} · {d.approval_status} · {d.subject || "—"} · {d.grade_levels || "All grades"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {d.external_url ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={d.external_url} target="_blank" rel="noreferrer">Open link</a>
                        </Button>
                      ) : null}
                      {d.approval_status === "APPROVED" && (
                        <Button size="sm" variant="secondary" onClick={() => openReader(String(d.id), d.title)}>
                          Read PDF
                        </Button>
                      )}
                      {d.approval_status === "PENDING" && (
                        <>
                          <Button size="sm" onClick={async () => {
                            try {
                              await api.post(`/library/digital/${d.id}/approve/`, {}, { headers });
                              toast.success("Approved");
                              await loadDigital();
                            } catch { toast.error("Approve failed (need librarian role)"); }
                          }}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={async () => {
                            try {
                              await api.post(`/library/digital/${d.id}/reject/`, {}, { headers });
                              toast.success("Rejected");
                              await loadDigital();
                            } catch { toast.error("Reject failed"); }
                          }}>Reject</Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
                {digital.length === 0 && (
                  <li className="p-6 text-muted-foreground text-center text-sm">No digital resources yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      
      {tab === "allocations" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Allocate textbooks to class</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Book title</Label>
                <Select value={allocForm.book_id} onValueChange={(v) => setAllocForm({ ...allocForm, book_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select book" /></SelectTrigger>
                  <SelectContent>
                    {books.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.title} ({b.copies_available ?? 0} avail.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grade / class</Label>
                <Input value={allocForm.grade_label} onChange={(e) => setAllocForm({ ...allocForm, grade_label: e.target.value })} placeholder="e.g. Grade 4" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Academic year</Label>
                  <Input value={allocForm.academic_year} onChange={(e) => setAllocForm({ ...allocForm, academic_year: e.target.value })} placeholder="2026" />
                </div>
                <div>
                  <Label>Term</Label>
                  <Input value={allocForm.term} onChange={(e) => setAllocForm({ ...allocForm, term: e.target.value })} placeholder="Term 1" />
                </div>
              </div>
              <div>
                <Label>Batch name</Label>
                <Input value={allocForm.name} onChange={(e) => setAllocForm({ ...allocForm, name: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label>Learners (hold Ctrl/Cmd for multi)</Label>
                <select
                  multiple
                  className="w-full min-h-[120px] border rounded-md p-2 text-sm"
                  value={allocForm.student_ids}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setAllocForm({ ...allocForm, student_ids: opts });
                  }}
                >
                  {students.slice(0, 300).map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.admission_number} — {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {allocForm.student_ids.length}. One available copy will be issued per learner.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={async () => {
                  if (!allocForm.book_id || allocForm.student_ids.length === 0) {
                    return toast.error("Select book and learners");
                  }
                  try {
                    await api.post("/library/class-allocations/allocate/", {
                      book_id: allocForm.book_id,
                      grade_label: allocForm.grade_label,
                      academic_year: allocForm.academic_year,
                      term: allocForm.term,
                      name: allocForm.name,
                      individual: true,
                      student_ids: allocForm.student_ids,
                    }, { headers });
                    toast.success("Allocation created");
                    const { data } = await api.get("/library/class-allocations/", { headers });
                    setAllocations(asList(data));
                  } catch (e: any) {
                    toast.error(e?.response?.data?.detail || "Allocation failed");
                  }
                }}
              >
                Allocate to selected learners
              </Button>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Allocation history</CardTitle>
              <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
                Print
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {allocations.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.grade_label || "—"} · {a.academic_year || "—"} {a.term || ""} · {String(a.created_at || "").slice(0, 10)}
                    </p>
                  </li>
                ))}
                {allocations.length === 0 && (
                  <li className="p-6 text-center text-muted-foreground text-sm">No allocations yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "stocktake" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Start / scan stocktake</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>New session name</Label>
                <Input value={stockForm.name} onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })} placeholder="Term 3 stocktake" />
              </div>
              <div>
                <Label>Location filter (optional)</Label>
                <Input value={stockForm.location_filter} onChange={(e) => setStockForm({ ...stockForm, location_filter: e.target.value })} placeholder="Shelf A" />
              </div>
              <Button
                onClick={async () => {
                  if (!stockForm.name.trim()) return toast.error("Name required");
                  try {
                    const { data } = await api.post("/library/stocktakes/", {
                      name: stockForm.name,
                      location_filter: stockForm.location_filter,
                    }, { headers });
                    toast.success("Stocktake started");
                    setStockForm({ ...stockForm, stocktake_id: data.id, name: "" });
                    const res = await api.get("/library/stocktakes/", { headers });
                    setStocktakes(asList(res.data));
                  } catch {
                    toast.error("Could not start stocktake");
                  }
                }}
              >
                Start stocktake
              </Button>
              <div>
                <Label>Active stocktake</Label>
                <Select value={stockForm.stocktake_id || "none"} onValueChange={(v) => setStockForm({ ...stockForm, stocktake_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select…</SelectItem>
                    {stocktakes.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scan accession number</Label>
                <Input value={stockForm.accession} onChange={(e) => setStockForm({ ...stockForm, accession: e.target.value })} placeholder="ACC-0001" />
              </div>
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!stockForm.stocktake_id || !stockForm.accession) return toast.error("Select session and accession");
                  try {
                    await api.post(`/library/stocktakes/${stockForm.stocktake_id}/scan/`, {
                      accession_number: stockForm.accession,
                    }, { headers });
                    toast.success("Recorded");
                    setStockForm({ ...stockForm, accession: "" });
                  } catch (e: any) {
                    toast.error(e?.response?.data?.detail || "Scan failed");
                  }
                }}
              >
                Record found
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!stockForm.stocktake_id) return;
                  try {
                    const { data } = await api.post(`/library/stocktakes/${stockForm.stocktake_id}/close/`, {}, { headers });
                    toast.success(`Closed — missing: ${data?.summary?.missing ?? "?"}`);
                    const res = await api.get("/library/stocktakes/", { headers });
                    setStocktakes(asList(res.data));
                  } catch (e: any) {
                    toast.error(e?.response?.data?.detail || "Close failed");
                  }
                }}
              >
                Close & mark missing
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Sessions</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {stocktakes.map((s) => (
                  <li key={s.id} className="px-4 py-3 text-sm flex justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground text-xs">{s.status}</span>
                  </li>
                ))}
                {stocktakes.length === 0 && (
                  <li className="p-6 text-center text-muted-foreground text-sm">No stocktakes yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}


      
      {readerUrl && (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-2">
            <CardTitle className="text-base flex-1">Reading: {readerTitle}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => {
              URL.revokeObjectURL(readerUrl);
              setReaderUrl("");
              setReaderId("");
            }}>Close reader</Button>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <iframe
              title={readerTitle}
              src={readerUrl}
              className="w-full h-[70vh] min-h-[320px] rounded-lg border bg-white"
            />
          </CardContent>
        </Card>
      )}

      {tab === "assignments" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign digital resource</CardTitle>
              <p className="text-xs text-muted-foreground">Teachers: assign approved resources to learners.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <AssignForm
                digital={digital.filter((d) => d.approval_status === "APPROVED")}
                students={students}
                headers={headers}
                onDone={async () => {
                  const { data } = await api.get("/library/assignments/", { headers });
                  setAssignments(asList(data));
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Assignments</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {assignments.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">Resource {String(a.resource).slice(0, 8)}…</p>
                    <p className="text-xs text-muted-foreground">
                      Due {a.due_date || "—"} · Grade {a.grade_label || "—"}
                    </p>
                    <p className="text-xs mt-1">{a.instructions}</p>
                  </li>
                ))}
                {assignments.length === 0 && (
                  <li className="p-6 text-center text-muted-foreground text-sm">No assignments yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}


      {tab === "settings" && settings && (
        <Card className="max-w-md">
          <CardHeader><CardTitle className="text-base">Loan rules</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ["student_loan_days", "Student loan days"],
              ["staff_loan_days", "Staff loan days"],
              ["max_active_loans_student", "Max active loans (student)"],
              ["max_active_loans_staff", "Max active loans (staff)"],
            ].map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  type="number"
                  value={settings[key] ?? ""}
                  onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                />
              </div>
            ))}
            <Button onClick={saveSettings}>Save settings</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
