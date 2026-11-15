"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  BookOpen,
  BookMarked,
  Download,
  FileText,
  Library,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
  Users,
} from "lucide-react";

type Tab = "read" | "loans" | "desk" | "catalogue" | "digital-manage";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function roleOf(user: any): string {
  return String(user?.role || "").toUpperCase();
}

export default function LibraryPage() {
  const { currentSchool, user } = useCurrentSchool() as any;
  const schoolId = currentSchool?.id;
  const role = roleOf(user);
  const isLearner = role === "STUDENT" || role === "PARENT";
  const isStaff = !isLearner;

  const [tab, setTab] = useState<Tab>(isLearner ? "read" : "desk");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const [resources, setResources] = useState<any[]>([]);
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [readerUrl, setReaderUrl] = useState("");
  const [readerTitle, setReaderTitle] = useState("");
  const [readerId, setReaderId] = useState("");

  const [dash, setDash] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [copies, setCopies] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [issueForm, setIssueForm] = useState({
    accession: "",
    admission_number: "",
    days: "14",
  });

  const [books, setBooks] = useState<any[]>([]);
  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    isbn: "",
    subject: "",
    copies: "1",
  });

  const [allDigital, setAllDigital] = useState<any[]>([]);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    subject: "",
    grade_levels: "",
    allow_download: false,
    file: null as File | null,
  });

  const headers = useMemo(
    () => (schoolId ? { "X-School-ID": String(schoolId) } : undefined),
    [schoolId]
  );

  const loadReadShelf = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const [dig, learn] = await Promise.all([
        api.get("/library/digital/", {
          headers,
          params: q ? { q } : undefined,
        }),
        api
          .get("/library/my-learning/", {
            headers,
            params: q ? { q } : undefined,
          })
          .catch(() => ({ data: {} })),
      ]);
      const digList = asList(dig.data);
      const approved = digList.length > 0 ? digList : asList(learn.data?.approved_resources);
      setResources(approved);
      setMyLoans(asList(learn.data?.my_loans));
      setAssignments(asList(learn.data?.assignments));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not load digital library");
    } finally {
      setLoading(false);
    }
  }, [headers, q]);

  const loadDesk = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const [d, st, cp, loans] = await Promise.all([
        api.get("/library/dashboard/", { headers }).catch(() => ({ data: null })),
        api.get("/students/", { headers, params: { limit: 200 } }).catch(() => ({ data: [] })),
        api
          .get("/library/copies/", { headers, params: { status: "AVAILABLE" } })
          .catch(() => ({ data: [] })),
        api
          .get("/library/borrowings/", { headers, params: { status: "ACTIVE" } })
          .catch(() => ({ data: [] })),
      ]);
      setDash(d.data);
      setStudents(asList(st.data));
      setCopies(asList(cp.data));
      setActiveLoans(asList(loans.data));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Desk load failed");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const loadCatalogue = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const { data } = await api.get("/library/books/", {
        headers,
        params: q ? { q } : undefined,
      });
      setBooks(asList(data));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Catalogue failed");
    } finally {
      setLoading(false);
    }
  }, [headers, q]);

  const loadDigitalManage = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const { data } = await api.get("/library/digital/", { headers });
      setAllDigital(asList(data));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Digital list failed");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!schoolId) return;
    if (tab === "read" || tab === "loans") void loadReadShelf();
    if (tab === "desk") void loadDesk();
    if (tab === "catalogue") void loadCatalogue();
    if (tab === "digital-manage") void loadDigitalManage();
  }, [tab, schoolId, loadReadShelf, loadDesk, loadCatalogue, loadDigitalManage]);

  useEffect(() => {
    return () => {
      if (readerUrl) URL.revokeObjectURL(readerUrl);
    };
  }, [readerUrl]);

  const openReader = async (id: string, title: string, externalUrl?: string) => {
    if (externalUrl) {
      window.open(externalUrl, "_blank");
      return;
    }
    try {
      const res = await api.get(`/library/digital/${id}/file/`, {
        headers,
        responseType: "blob",
      });
      if (readerUrl) URL.revokeObjectURL(readerUrl);
      const url = URL.createObjectURL(res.data);
      setReaderUrl(url);
      setReaderTitle(title);
      setReaderId(id);
      try {
        await api.post(`/library/digital/${id}/progress/`, { page: "1" }, { headers });
      } catch {
        /* optional */
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not open file");
    }
  };

  const downloadResource = async (id: string, title: string) => {
    try {
      const res = await api.get(`/library/digital/${id}/file/`, {
        headers,
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "resource"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Download not allowed or failed");
    }
  };

  const issueBook = async () => {
    if (!issueForm.accession.trim() || !issueForm.admission_number.trim()) {
      toast.error("Accession number and admission number are required");
      return;
    }
    try {
      let copyList = copies.filter(
        (c) =>
          String(c.accession_number || c.accession || "").toLowerCase() ===
          issueForm.accession.trim().toLowerCase()
      );
      if (!copyList.length) {
        const { data } = await api.get("/library/copies/", {
          headers,
          params: { q: issueForm.accession.trim() },
        });
        copyList = asList(data).filter(
          (x: any) =>
            String(x.accession_number || x.accession || "").toLowerCase() ===
            issueForm.accession.trim().toLowerCase()
        );
        if (!copyList.length) copyList = asList(data);
      }
      const c = copyList[0];
      if (!c?.id) {
        toast.error("Copy not found — check accession number");
        return;
      }
      let student = students.find(
        (s) =>
          String(s.admission_number || "").toLowerCase() ===
          issueForm.admission_number.trim().toLowerCase()
      );
      if (!student) {
        const { data } = await api.get("/students/", {
          headers,
          params: { search: issueForm.admission_number.trim() },
        });
        const list = asList(data);
        student =
          list.find(
            (s: any) =>
              String(s.admission_number || "").toLowerCase() ===
              issueForm.admission_number.trim().toLowerCase()
          ) || list[0];
      }
      if (!student?.id) {
        toast.error("Student not found");
        return;
      }
      const days = Math.max(1, Number(issueForm.days) || 14);
      const due = new Date();
      due.setDate(due.getDate() + days);
      await api.post(
        "/library/borrowings/issue/",
        {
          copy_id: c.id,
          student_id: student.id,
          due_date: due.toISOString().slice(0, 10),
        },
        { headers }
      );
      toast.success("Book issued");
      setIssueForm((f) => ({ ...f, accession: "", admission_number: "" }));
      loadDesk();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Issue failed");
    }
  };

  const returnLoan = async (id: string) => {
    try {
      await api.post(`/library/borrowings/${id}/return_loan/`, {}, { headers });
      toast.success("Returned");
      loadDesk();
      loadReadShelf();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Return failed");
    }
  };

  const addBook = async () => {
    if (!bookForm.title.trim()) {
      toast.error("Title required");
      return;
    }
    try {
      const { data: book } = await api.post(
        "/library/books/",
        {
          title: bookForm.title.trim(),
          author: bookForm.author.trim(),
          isbn: bookForm.isbn.trim(),
          subject: bookForm.subject.trim(),
        },
        { headers }
      );
      const n = Math.max(1, Number(bookForm.copies) || 1);
      if (book?.id) {
        await api.post(
          "/library/books/register-copies/",
          { book_id: book.id, quantity: n },
          { headers }
        );
      }
      toast.success("Book added");
      setBookForm({ title: "", author: "", isbn: "", subject: "", copies: "1" });
      loadCatalogue();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not add book");
    }
  };

  const uploadDigital = async () => {
    if (!uploadForm.title.trim() || !uploadForm.file) {
      toast.error("Title and file required");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("title", uploadForm.title.trim());
      fd.append("subject", uploadForm.subject.trim());
      fd.append("grade_levels", uploadForm.grade_levels.trim());
      fd.append("allow_download", uploadForm.allow_download ? "true" : "false");
      fd.append("file", uploadForm.file);
      await api.post("/library/digital/", fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      toast.success("Uploaded — approve before learners see it");
      setUploadForm({
        title: "",
        subject: "",
        grade_levels: "",
        allow_download: false,
        file: null,
      });
      loadDigitalManage();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    }
  };

  const approveDigital = async (id: string) => {
    try {
      await api.post(`/library/digital/${id}/approve/`, {}, { headers });
      toast.success("Approved — now on Read online shelf");
      loadDigitalManage();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Approve failed");
    }
  };

  const tabs: { id: Tab; label: string; staffOnly?: boolean }[] = [
    { id: "read", label: "Read online" },
    { id: "loans", label: "My loans" },
    { id: "desk", label: "Issue / return", staffOnly: true },
    { id: "catalogue", label: "Catalogue", staffOnly: true },
    { id: "digital-manage", label: "Manage digital", staffOnly: true },
  ];
  const visibleTabs = tabs.filter((t) => !t.staffOnly || isStaff);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-7 w-7 text-primary" />
            Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Borrow physical books · read and download approved digital resources
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (tab === "read" || tab === "loans") loadReadShelf();
            if (tab === "desk") loadDesk();
            if (tab === "catalogue") loadCatalogue();
            if (tab === "digital-manage") loadDigitalManage();
          }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b pb-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "read" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs">Search titles or subjects</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="e.g. Mathematics, Grade 4…"
                  onKeyDown={(e) => e.key === "Enter" && loadReadShelf()}
                />
              </div>
            </div>
            <Button onClick={() => loadReadShelf()}>Search</Button>
          </div>

          {assignments.length > 0 && (
            <Card className="rounded-xl border-amber-200 bg-amber-50/50">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookMarked className="h-4 w-4" /> Reading assignments
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {assignments.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-amber-100 pb-2"
                  >
                    <span>
                      {a.resource_title || a.resource?.title || "Resource"}
                      {a.due_date ? (
                        <span className="text-xs text-muted-foreground ml-2">
                          due {String(a.due_date).slice(0, 10)}
                        </span>
                      ) : null}
                    </span>
                    {(a.resource_id || a.resource?.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openReader(
                            String(a.resource_id || a.resource?.id),
                            a.resource_title || a.resource?.title || "Resource"
                          )
                        }
                      >
                        Open
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {readerUrl && (
            <Card className="rounded-xl overflow-hidden">
              <CardHeader className="py-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{readerTitle}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    URL.revokeObjectURL(readerUrl);
                    setReaderUrl("");
                    setReaderId("");
                  }}
                >
                  Close
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <iframe title={readerTitle} src={readerUrl} className="w-full h-[70vh] bg-white" />
              </CardContent>
            </Card>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading && !resources.length ? (
              <p className="text-sm text-muted-foreground col-span-full flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading shelf…
              </p>
            ) : null}
            {!loading && resources.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
                No approved digital books yet. Staff: upload under Manage digital, then Approve.
              </p>
            ) : null}
            {resources.map((r) => (
              <Card key={r.id} className="rounded-xl">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-snug">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[r.subject, r.grade_levels].filter(Boolean).join(" · ") || "Digital resource"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => openReader(String(r.id), r.title, r.external_url)}
                    >
                      <BookOpen className="h-3.5 w-3.5 mr-1" />
                      Read
                    </Button>
                    {r.allow_download ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadResource(String(r.id), r.title)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground self-center">
                        Online only
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "loans" && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Books you currently have</CardTitle>
          </CardHeader>
          <CardContent>
            {!myLoans.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No active loans. Visit the library desk to borrow a physical book.
              </p>
            ) : (
              <ul className="divide-y">
                {myLoans.map((l) => (
                  <li key={l.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">
                        {l.book_title || l.book?.title || "Book"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        due {String(l.due_date || "").slice(0, 10)} · {l.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "desk" && isStaff && (
        <div className="grid lg:grid-cols-2 gap-4">
          {dash && (
            <Card className="rounded-xl lg:col-span-2">
              <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Titles</p>
                  <p className="text-xl font-semibold">{dash.books?.total ?? dash.titles ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">On loan</p>
                  <p className="text-xl font-semibold">
                    {dash.borrowings?.active ?? activeLoans.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-xl font-semibold text-amber-700">
                    {dash.borrowings?.overdue ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Digital</p>
                  <p className="text-xl font-semibold">{dash.digital?.total ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Issue book
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Copy accession #</Label>
                <Input
                  value={issueForm.accession}
                  onChange={(e) => setIssueForm((f) => ({ ...f, accession: e.target.value }))}
                  placeholder="e.g. ACC-00012"
                />
              </div>
              <div className="space-y-1">
                <Label>Learner admission #</Label>
                <Input
                  value={issueForm.admission_number}
                  onChange={(e) =>
                    setIssueForm((f) => ({ ...f, admission_number: e.target.value }))
                  }
                  placeholder="e.g. PSS-2026-0001"
                />
              </div>
              <div className="space-y-1">
                <Label>Loan days</Label>
                <Input
                  type="number"
                  value={issueForm.days}
                  onChange={(e) => setIssueForm((f) => ({ ...f, days: e.target.value }))}
                />
              </div>
              <Button className="w-full" onClick={issueBook}>
                Issue
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Active loans — return
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y max-h-[420px] overflow-y-auto">
                {activeLoans.map((l) => (
                  <li
                    key={l.id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{l.book_title || l.book?.title || "Book"}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.student_name ||
                          l.student?.full_name ||
                          l.student?.admission_number ||
                          "Borrower"}{" "}
                        · due {String(l.due_date || "").slice(0, 10)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => returnLoan(l.id)}>
                      Return
                    </Button>
                  </li>
                ))}
                {!activeLoans.length && (
                  <li className="p-6 text-center text-muted-foreground text-sm">No active loans</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "catalogue" && isStaff && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Add title</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="Title *"
                value={bookForm.title}
                onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
              />
              <Input
                placeholder="Author"
                value={bookForm.author}
                onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))}
              />
              <Input
                placeholder="ISBN"
                value={bookForm.isbn}
                onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))}
              />
              <Input
                placeholder="Subject"
                value={bookForm.subject}
                onChange={(e) => setBookForm((f) => ({ ...f, subject: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Copies"
                value={bookForm.copies}
                onChange={(e) => setBookForm((f) => ({ ...f, copies: e.target.value }))}
              />
              <Button className="w-full" onClick={addBook}>
                Save book
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-xl lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Titles</CardTitle>
              <Input
                className="max-w-[200px] h-8"
                placeholder="Filter…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadCatalogue()}
              />
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y max-h-[480px] overflow-y-auto">
                {books.map((b) => (
                  <li key={b.id} className="px-4 py-2 text-sm">
                    <p className="font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[b.author, b.subject, b.isbn].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
                {!books.length && (
                  <li className="p-6 text-center text-muted-foreground text-sm">
                    No books yet — add your first title.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "digital-manage" && isStaff && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload resource
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                placeholder="Title *"
                value={uploadForm.title}
                onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
              />
              <Input
                placeholder="Subject"
                value={uploadForm.subject}
                onChange={(e) => setUploadForm((f) => ({ ...f, subject: e.target.value }))}
              />
              <Input
                placeholder="Grades e.g. Grade 4, Grade 5"
                value={uploadForm.grade_levels}
                onChange={(e) => setUploadForm((f) => ({ ...f, grade_levels: e.target.value }))}
              />
              <Input
                type="file"
                accept=".pdf,.epub,image/*,audio/*,video/*"
                onChange={(e) =>
                  setUploadForm((f) => ({ ...f, file: e.target.files?.[0] || null }))
                }
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={uploadForm.allow_download}
                  onChange={(e) =>
                    setUploadForm((f) => ({ ...f, allow_download: e.target.checked }))
                  }
                />
                Allow learners to download
              </label>
              <Button className="w-full" onClick={uploadDigital}>
                Upload
              </Button>
              <p className="text-[11px] text-muted-foreground">
                New uploads need Approve before they appear on Read online.
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Digital inventory</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y max-h-[480px] overflow-y-auto">
                {allDigital.map((r) => (
                  <li
                    key={r.id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.approval_status}
                        {r.allow_download ? " · downloadable" : " · online only"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {r.approval_status !== "APPROVED" && (
                        <Button size="sm" onClick={() => approveDigital(String(r.id))}>
                          Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReader(String(r.id), r.title, r.external_url)}
                      >
                        Preview
                      </Button>
                    </div>
                  </li>
                ))}
                {!allDigital.length && (
                  <li className="p-6 text-center text-muted-foreground text-sm">
                    No digital resources yet.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
