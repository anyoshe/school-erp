"use client";

/**
 * Library module — student read/download + staff catalogue, issue/return,
 * digital management (delete rejected, dedupe), and stock audit.
 */
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
  ClipboardList,
  Download,
  Library,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Tab =
  | "read"
  | "loans"
  | "desk"
  | "catalogue"
  | "digital-manage"
  | "stock-audit";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function roleOf(user: any): string {
  return String(user?.role || "").toUpperCase();
}

/** School textbooks / learning materials (grade-based) vs general library stock */
const TEXTBOOK_KINDS = [
  { value: "TEXTBOOK", label: "Core textbook" },
  { value: "REVISION", label: "Revision material" },
  { value: "TEACHER_REF", label: "Teacher guide / reference" },
  { value: "OTHER", label: "Other class learning material" },
];

const GENERAL_BOOK_CATEGORIES = [
  { value: "STORYBOOK", label: "Storybook" },
  { value: "REFERENCE", label: "General reference" },
  { value: "DICTIONARY", label: "Dictionary" },
  { value: "ENCYCLOPEDIA", label: "Encyclopedia" },
  { value: "OTHER", label: "Other" },
];

const COMMON_GRADES = [
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Form 1",
  "Form 2",
  "Form 3",
  "Form 4",
];

const COMMON_SUBJECTS = [
  "Mathematics",
  "English",
  "Kiswahili",
  "Science",
  "Biology",
  "Chemistry",
  "Physics",
  "History",
  "Geography",
  "CRE",
  "IRE",
  "Business Studies",
  "Agriculture",
  "Computer Studies",
  "Home Science",
  "Creative Arts",
  "French",
  "German",
];

const emptyBookForm = () => ({
  // mode: textbook = grade/subject driven; general = library fiction/reference
  mode: "textbook" as "textbook" | "general",
  title: "",
  subtitle: "",
  author: "",
  publisher: "",
  isbn: "",
  edition: "",
  publication_year: "",
  language: "English",
  description: "",
  subject: "",
  learning_area: "",
  topic: "",
  grade_levels: "",
  curriculum: "CBC",
  category: "TEXTBOOK",
  copies: "1",
  accession_prefix: "",
  storage_location: "",
  acquisition_source: "",
});

export default function LibraryPage() {
  const { currentSchool, user } = useCurrentSchool() as any;
  const schoolId = currentSchool?.id;
  const role = roleOf(user);
  const isLearner = role === "STUDENT" || role === "PARENT";
  const isStaff = !isLearner;

  const [tab, setTab] = useState<Tab>(isLearner ? "read" : "desk");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // Read / loans
  const [resources, setResources] = useState<any[]>([]);
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [readerUrl, setReaderUrl] = useState("");
  const [readerTitle, setReaderTitle] = useState("");
  const [readerId, setReaderId] = useState("");

  // Desk
  const [dash, setDash] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [copies, setCopies] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [issueForm, setIssueForm] = useState({
    accession: "",
    admission_number: "",
    days: "14",
  });

  // Catalogue — textbooks (grade/subject) + general library
  const [books, setBooks] = useState<any[]>([]);
  const [bookForm, setBookForm] = useState(emptyBookForm());
  const [showBookForm, setShowBookForm] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [catView, setCatView] = useState<"textbooks" | "general" | "all">("textbooks");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  // Digital manage
  const [allDigital, setAllDigital] = useState<any[]>([]);
  const [digitalFilter, setDigitalFilter] = useState<string>("");
  const [uploadForm, setUploadForm] = useState({
    title: "",
    subject: "",
    grade_levels: "",
    author: "",
    external_url: "",
    allow_download: false,
    file: null as File | null,
  });

  // Stock audit
  const [stockSummary, setStockSummary] = useState<any>(null);
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [activeStocktake, setActiveStocktake] = useState<any>(null);
  const [scanAccession, setScanAccession] = useState("");
  const [stocktakeName, setStocktakeName] = useState("");

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
      const approved =
        digList.length > 0 ? digList : asList(learn.data?.approved_resources);
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
        api
          .get("/students/", { headers, params: { limit: 200 } })
          .catch(() => ({ data: [] })),
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
      const params: any = {};
      if (digitalFilter) params.approval_status = digitalFilter;
      if (q) params.q = q;
      const { data } = await api.get("/library/digital/", { headers, params });
      setAllDigital(asList(data));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Digital list failed");
    } finally {
      setLoading(false);
    }
  }, [headers, digitalFilter, q]);

  const loadStockAudit = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const [sum, takes, dashRes] = await Promise.all([
        api.get("/library/stock-audit-summary/", { headers }).catch(() => ({ data: null })),
        api.get("/library/stocktakes/", { headers }).catch(() => ({ data: [] })),
        api.get("/library/dashboard/", { headers }).catch(() => ({ data: null })),
      ]);
      // Prefer dedicated summary; fall back to dashboard numbers
      const s = sum.data;
      if (s && (s.copies_total != null || s.titles != null)) {
        setStockSummary(s);
      } else if (dashRes.data) {
        const d = dashRes.data;
        const phys = d.physical || d;
        setStockSummary({
          titles: phys.titles ?? d.titles,
          copies_total: phys.copies_total ?? d.copies_total,
          available: phys.available ?? d.available,
          issued: phys.issued ?? d.issued,
          by_status: phys.by_status || {},
          open_stocktakes: asList(takes.data).filter(
            (t: any) => t.status === "OPEN"
          ).length,
          lost_or_damaged:
            (phys.lost || 0) + (phys.damaged || 0) + (phys.written_off || 0),
        });
      }
      setStocktakes(asList(takes.data));
      const open = asList(takes.data).find((t: any) => t.status === "OPEN");
      setActiveStocktake(open || null);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Stock audit load failed");
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
    if (tab === "stock-audit") void loadStockAudit();
  }, [
    tab,
    schoolId,
    loadReadShelf,
    loadDesk,
    loadCatalogue,
    loadDigitalManage,
    loadStockAudit,
  ]);

  useEffect(() => {
    return () => {
      if (readerUrl) URL.revokeObjectURL(readerUrl);
    };
  }, [readerUrl]);

  const openReader = async (
    id: string,
    title: string,
    externalUrl?: string
  ) => {
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
        await api.post(
          `/library/digital/${id}/progress/`,
          { page: "1" },
          { headers }
        );
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
      toast.error(
        e?.response?.data?.detail ||
          JSON.stringify(e?.response?.data) ||
          "Issue failed"
      );
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

  /** School textbook / learning material, or general library book */
  const addBook = async () => {
    if (!bookForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const isTextbook = bookForm.mode === "textbook";
    if (isTextbook) {
      if (!bookForm.grade_levels.trim()) {
        toast.error("Grade level(s) required for school textbooks");
        return;
      }
      if (!bookForm.subject.trim()) {
        toast.error("Subject required for school textbooks");
        return;
      }
      if (!bookForm.publisher.trim()) {
        toast.error("Publisher required (e.g. KLB, Longhorn, Oxford)");
        return;
      }
    }
    setSavingBook(true);
    try {
      const payload: any = {
        title: bookForm.title.trim(),
        subtitle: bookForm.subtitle.trim(),
        author: bookForm.author.trim(),
        publisher: bookForm.publisher.trim(),
        isbn: bookForm.isbn.trim(),
        edition: bookForm.edition.trim(),
        language: bookForm.language.trim() || "English",
        description: bookForm.description.trim(),
        subject: bookForm.subject.trim(),
        learning_area: bookForm.learning_area.trim(),
        topic: bookForm.topic.trim(),
        grade_levels: bookForm.grade_levels.trim(),
        curriculum: bookForm.curriculum.trim(),
        category: bookForm.category || (isTextbook ? "TEXTBOOK" : "OTHER"),
      };
      if (bookForm.publication_year) {
        const y = Number(bookForm.publication_year);
        if (!Number.isNaN(y)) payload.publication_year = y;
      }
      const { data: book } = await api.post("/library/books/", payload, {
        headers,
      });
      const n = Math.max(1, Number(bookForm.copies) || 1);
      if (book?.id) {
        // Prefix accessions by grade/subject when textbook for easier shelf control
        let prefix = bookForm.accession_prefix.trim();
        if (!prefix && isTextbook) {
          const g = bookForm.grade_levels
            .split(",")[0]
            .trim()
            .replace(/\s+/g, "")
            .slice(0, 8)
            .toUpperCase();
          const s = bookForm.subject.trim().slice(0, 4).toUpperCase();
          prefix = `${g}-${s}-`;
        }
        await api.post(
          "/library/books/register-copies/",
          {
            book_id: book.id,
            count: n,
            quantity: n,
            accession_prefix: prefix || undefined,
            storage_location: bookForm.storage_location.trim() || undefined,
            acquisition_source: bookForm.acquisition_source.trim() || undefined,
          },
          { headers }
        );
      }
      const kind =
        TEXTBOOK_KINDS.find((k) => k.value === bookForm.category)?.label ||
        "Item";
      toast.success(
        isTextbook
          ? `Textbook saved: ${bookForm.subject} · ${bookForm.grade_levels} · ${kind} (${n} copies)`
          : `Added “${bookForm.title.trim()}” with ${n} copy${n > 1 ? "ies" : ""}`
      );
      setBookForm(emptyBookForm());
      setShowBookForm(false);
      loadCatalogue();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.title?.[0] ||
        e?.response?.data?.isbn?.[0] ||
        (typeof e?.response?.data === "object"
          ? JSON.stringify(e.response.data)
          : null) ||
        "Could not add book";
      toast.error(String(detail));
    } finally {
      setSavingBook(false);
    }
  };

  const filteredBooks = useMemo(() => {
    let list = books;
    if (catView === "textbooks") {
      list = list.filter((b) => {
        const c = String(b.category || "").toUpperCase();
        return (
          ["TEXTBOOK", "REVISION", "TEACHER_REF"].includes(c) ||
          (c === "OTHER" && (b.grade_levels || b.subject))
        );
      });
    } else if (catView === "general") {
      list = list.filter((b) => {
        const c = String(b.category || "").toUpperCase();
        return ["STORYBOOK", "REFERENCE", "DICTIONARY", "ENCYCLOPEDIA"].includes(c) ||
          (c === "OTHER" && !(b.grade_levels || "").trim());
      });
    }
    if (filterGrade) {
      list = list.filter((b) =>
        String(b.grade_levels || "")
          .toLowerCase()
          .includes(filterGrade.toLowerCase())
      );
    }
    if (filterSubject) {
      list = list.filter((b) =>
        String(b.subject || "")
          .toLowerCase()
          .includes(filterSubject.toLowerCase())
      );
    }
    return list;
  }, [books, catView, filterGrade, filterSubject]);

  /** Group textbooks by grade then subject for shelf-style browsing */
  const booksByGrade = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const b of filteredBooks) {
      const grades = String(b.grade_levels || "Unspecified")
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);
      const keys = grades.length ? grades : ["Unspecified"];
      for (const g of keys) {
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(b);
      }
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true })
    );
  }, [filteredBooks]);

  const uploadDigital = async () => {
    if (!uploadForm.title.trim()) {
      toast.error("Title required");
      return;
    }
    if (!uploadForm.file && !uploadForm.external_url.trim()) {
      toast.error("Attach a file or enter an external URL");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("title", uploadForm.title.trim());
      fd.append("subject", uploadForm.subject.trim());
      fd.append("grade_levels", uploadForm.grade_levels.trim());
      fd.append("author", uploadForm.author.trim());
      fd.append("allow_download", uploadForm.allow_download ? "true" : "false");
      if (uploadForm.external_url.trim()) {
        fd.append("external_url", uploadForm.external_url.trim());
      }
      if (uploadForm.file) fd.append("file", uploadForm.file);
      await api.post("/library/digital/", fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      toast.success(
        "Uploaded. Librarians auto-approve; teacher uploads need Approve before learners see them."
      );
      setUploadForm({
        title: "",
        subject: "",
        grade_levels: "",
        author: "",
        external_url: "",
        allow_download: false,
        file: null,
      });
      loadDigitalManage();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "object"
          ? JSON.stringify(e.response.data)
          : null) ||
        "Upload failed";
      toast.error(String(detail));
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

  const rejectDigital = async (id: string) => {
    try {
      await api.post(`/library/digital/${id}/reject/`, {}, { headers });
      toast.success("Rejected");
      loadDigitalManage();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Reject failed");
    }
  };

  const deleteDigital = async (id: string, status: string) => {
    const msg =
      status === "REJECTED"
        ? "Delete this rejected resource permanently?"
        : "Delete this digital resource permanently?";
    if (!window.confirm(msg)) return;
    try {
      await api.delete(`/library/digital/${id}/`, { headers });
      toast.success("Deleted");
      loadDigitalManage();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.detail ||
          "Delete failed (only staff can delete; teachers only own pending/rejected)"
      );
    }
  };

  const startStocktake = async () => {
    const name =
      stocktakeName.trim() ||
      `Stocktake ${new Date().toISOString().slice(0, 10)}`;
    try {
      const { data } = await api.post(
        "/library/stocktakes/",
        { name },
        { headers }
      );
      toast.success("Stocktake started — scan accession numbers");
      setStocktakeName("");
      setActiveStocktake(data);
      loadStockAudit();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not start stocktake");
    }
  };

  const scanCopy = async () => {
    if (!activeStocktake?.id) {
      toast.error("Start or select an open stocktake first");
      return;
    }
    if (!scanAccession.trim()) {
      toast.error("Enter accession number");
      return;
    }
    try {
      await api.post(
        `/library/stocktakes/${activeStocktake.id}/scan/`,
        { accession_number: scanAccession.trim() },
        { headers }
      );
      toast.success(`Scanned ${scanAccession.trim()}`);
      setScanAccession("");
    } catch (e: any) {
      toast.error(
        e?.response?.data?.detail ||
          e?.response?.data?.accession_number?.[0] ||
          "Scan failed"
      );
    }
  };

  const closeStocktake = async (id: string) => {
    if (!window.confirm("Close this stocktake? Missing items will be recorded."))
      return;
    try {
      await api.post(`/library/stocktakes/${id}/close/`, {}, { headers });
      toast.success("Stocktake closed");
      setActiveStocktake(null);
      loadStockAudit();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Close failed");
    }
  };

  const tabs: { id: Tab; label: string; staffOnly?: boolean }[] = [
    { id: "read", label: "Read online" },
    { id: "loans", label: "My loans" },
    { id: "desk", label: "Issue / return", staffOnly: true },
    { id: "catalogue", label: "Textbooks & stock", staffOnly: true },
    { id: "digital-manage", label: "Manage digital", staffOnly: true },
    { id: "stock-audit", label: "Stock audit", staffOnly: true },
  ];
  const visibleTabs = tabs.filter((t) => !t.staffOnly || isStaff);

  const refresh = () => {
    if (tab === "read" || tab === "loans") loadReadShelf();
    if (tab === "desk") loadDesk();
    if (tab === "catalogue") loadCatalogue();
    if (tab === "digital-manage") loadDigitalManage();
    if (tab === "stock-audit") loadStockAudit();
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-7 w-7 text-primary" />
            Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Physical books & learning materials · digital reading · stock audit
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
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

      {/* ========== READ ONLINE ========== */}
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
            <Button onClick={loadReadShelf}>Search</Button>
          </div>

          {assignments.length > 0 && (
            <Card className="rounded-xl border-amber-200 bg-amber-50/50">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Assigned to you</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {assignments.slice(0, 8).map((a: any) => (
                  <div
                    key={a.id}
                    className="flex justify-between gap-2 text-sm"
                  >
                    <span className="font-medium">
                      {a.resource_title || a.resource?.title || "Resource"}
                    </span>
                    {a.due_date && (
                      <span className="text-xs text-muted-foreground">
                        due {String(a.due_date).slice(0, 10)}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {resources.map((r) => (
              <Card key={r.id} className="rounded-xl">
                <CardContent className="p-4 space-y-2">
                  <p className="font-semibold leading-snug">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.subject, r.grade_levels, r.author]
                      .filter(Boolean)
                      .join(" · ") || "Digital resource"}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() =>
                        openReader(String(r.id), r.title, r.external_url)
                      }
                    >
                      <BookOpen className="h-3.5 w-3.5 mr-1" />
                      Read
                    </Button>
                    {r.allow_download ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          downloadResource(String(r.id), r.title)
                        }
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
            {!resources.length && !loading && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-10">
                No approved digital resources yet. Staff can upload under Manage
                digital.
              </p>
            )}
          </div>

          {readerUrl && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-xl">
                <div className="flex items-center justify-between px-4 py-2 border-b">
                  <p className="font-medium text-sm truncate">{readerTitle}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      URL.revokeObjectURL(readerUrl);
                      setReaderUrl("");
                      setReaderId("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <iframe
                  title={readerTitle}
                  src={readerUrl}
                  className="flex-1 w-full rounded-b-xl"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== MY LOANS ========== */}
      {tab === "loans" && (
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">
              Books you currently have
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!myLoans.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No active loans. Visit the library desk to borrow a physical
                book.
              </p>
            ) : (
              <ul className="divide-y">
                {myLoans.map((l) => (
                  <li
                    key={l.id}
                    className="py-3 flex flex-wrap justify-between gap-2 text-sm"
                  >
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

      {/* ========== ISSUE / RETURN ========== */}
      {tab === "desk" && isStaff && (
        <div className="grid lg:grid-cols-2 gap-4">
          {dash && (
            <Card className="rounded-xl lg:col-span-2">
              <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold">
                    {dash.physical?.available ?? dash.available ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {dash.physical?.issued ?? dash.issued ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Issued</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {dash.physical?.overdue ?? dash.overdue ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {dash.physical?.titles ?? dash.titles ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Titles</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Issue book</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Accession number</Label>
                <Input
                  value={issueForm.accession}
                  onChange={(e) =>
                    setIssueForm((f) => ({ ...f, accession: e.target.value }))
                  }
                  placeholder="e.g. ACC-00123"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Learner admission number</Label>
                <Input
                  value={issueForm.admission_number}
                  onChange={(e) =>
                    setIssueForm((f) => ({
                      ...f,
                      admission_number: e.target.value,
                    }))
                  }
                  placeholder="e.g. ADM/2024/045"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Loan days</Label>
                <Input
                  type="number"
                  min={1}
                  value={issueForm.days}
                  onChange={(e) =>
                    setIssueForm((f) => ({ ...f, days: e.target.value }))
                  }
                />
              </div>
              <Button className="w-full" onClick={issueBook}>
                Issue
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Active loans — return</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y max-h-[360px] overflow-y-auto">
                {activeLoans.map((l) => (
                  <li
                    key={l.id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {l.book_title || l.book?.title || "Book"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.student_name || l.accession_number || ""} · due{" "}
                        {String(l.due_date || "").slice(0, 10)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => returnLoan(String(l.id))}>
                      Return
                    </Button>
                  </li>
                ))}
                {!activeLoans.length && (
                  <li className="p-6 text-center text-muted-foreground text-sm">
                    No active loans
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== CATALOGUE — school textbooks by grade/subject + general ========== */}
      {tab === "catalogue" && isStaff && (
        <div className="space-y-4">
          {/* View switcher: textbooks vs general library */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["textbooks", "School textbooks"],
                ["general", "General library"],
                ["all", "All titles"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCatView(id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  catView === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-end justify-between">
            <div className="flex flex-1 flex-wrap gap-2 items-end min-w-[200px]">
              <div className="min-w-[140px] space-y-1">
                <Label className="text-xs">Grade</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                >
                  <option value="">All grades</option>
                  {COMMON_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px] space-y-1">
                <Label className="text-xs">Subject</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="">All subjects</option>
                  {COMMON_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[160px] space-y-1">
                <Label className="text-xs">Search</Label>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Title, publisher, ISBN…"
                  onKeyDown={(e) => e.key === "Enter" && loadCatalogue()}
                />
              </div>
              <Button variant="outline" onClick={loadCatalogue}>
                Search
              </Button>
            </div>
            <Button
              onClick={() => {
                setBookForm((f) => ({
                  ...emptyBookForm(),
                  mode: catView === "general" ? "general" : "textbook",
                  category: catView === "general" ? "STORYBOOK" : "TEXTBOOK",
                }));
                setShowBookForm((v) => !v);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              {showBookForm
                ? "Hide form"
                : catView === "general"
                  ? "Add library book"
                  : "Add textbook"}
            </Button>
          </div>

          {showBookForm && (
            <Card className="rounded-xl border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {bookForm.mode === "textbook"
                    ? "Register school textbook / class material"
                    : "Add general library book"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {bookForm.mode === "textbook"
                    ? "Textbooks are organised by grade, subject and publisher (core, revision, or teacher guide). Copies can be issued to learners or teachers."
                    : "Storybooks, dictionaries and general reference — not tied to a class grade."}
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1 text-xs ${
                      bookForm.mode === "textbook"
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-100"
                    }`}
                    onClick={() =>
                      setBookForm((f) => ({
                        ...f,
                        mode: "textbook",
                        category: "TEXTBOOK",
                        curriculum: f.curriculum || "CBC",
                      }))
                    }
                  >
                    School textbook
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1 text-xs ${
                      bookForm.mode === "general"
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-100"
                    }`}
                    onClick={() =>
                      setBookForm((f) => ({
                        ...f,
                        mode: "general",
                        category: "STORYBOOK",
                        grade_levels: "",
                        subject: "",
                      }))
                    }
                  >
                    General library
                  </button>
                </div>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3">
                {bookForm.mode === "textbook" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Kind *</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={bookForm.category}
                        onChange={(e) =>
                          setBookForm((f) => ({
                            ...f,
                            category: e.target.value,
                          }))
                        }
                      >
                        {TEXTBOOK_KINDS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Curriculum</Label>
                      <Input
                        value={bookForm.curriculum}
                        onChange={(e) =>
                          setBookForm((f) => ({
                            ...f,
                            curriculum: e.target.value,
                          }))
                        }
                        placeholder="CBC, 8-4-4, IGCSE…"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Grade level(s) *</Label>
                      <Input
                        list="grade-suggestions"
                        value={bookForm.grade_levels}
                        onChange={(e) =>
                          setBookForm((f) => ({
                            ...f,
                            grade_levels: e.target.value,
                          }))
                        }
                        placeholder="e.g. Grade 4  or  7,8"
                      />
                      <datalist id="grade-suggestions">
                        {COMMON_GRADES.map((g) => (
                          <option key={g} value={g} />
                        ))}
                      </datalist>
                      <p className="text-[10px] text-muted-foreground">
                        Comma-separate if the same title serves several grades
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Subject *</Label>
                      <Input
                        list="subject-suggestions"
                        value={bookForm.subject}
                        onChange={(e) =>
                          setBookForm((f) => ({
                            ...f,
                            subject: e.target.value,
                          }))
                        }
                        placeholder="e.g. Mathematics"
                      />
                      <datalist id="subject-suggestions">
                        {COMMON_SUBJECTS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Publisher *</Label>
                      <Input
                        value={bookForm.publisher}
                        onChange={(e) =>
                          setBookForm((f) => ({
                            ...f,
                            publisher: e.target.value,
                          }))
                        }
                        placeholder="KLB, Longhorn, Oxford, Moran…"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Learning area</Label>
                      <Input
                        value={bookForm.learning_area}
                        onChange={(e) =>
                          setBookForm((f) => ({
                            ...f,
                            learning_area: e.target.value,
                          }))
                        }
                        placeholder="e.g. Numeracy (CBC)"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Title *</Label>
                  <Input
                    value={bookForm.title}
                    onChange={(e) =>
                      setBookForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder={
                      bookForm.mode === "textbook"
                        ? "e.g. Our Lives Today Social Studies Grade 4"
                        : "Official title"
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Author / series editor</Label>
                  <Input
                    value={bookForm.author}
                    onChange={(e) =>
                      setBookForm((f) => ({ ...f, author: e.target.value }))
                    }
                  />
                </div>
                {bookForm.mode === "general" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={bookForm.category}
                        onChange={(e) =>
                          setBookForm((f) => ({
                            ...f,
                            category: e.target.value,
                          }))
                        }
                      >
                        {GENERAL_BOOK_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Publisher</Label>
                      <Input
                        value={bookForm.publisher}
                        onChange={(e) =>
                          setBookForm((f) => ({
                            ...f,
                            publisher: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">ISBN</Label>
                  <Input
                    value={bookForm.isbn}
                    onChange={(e) =>
                      setBookForm((f) => ({ ...f, isbn: e.target.value }))
                    }
                    placeholder="Blocks double registration if already in catalogue"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Edition / year</Label>
                  <div className="flex gap-2">
                    <Input
                      value={bookForm.edition}
                      onChange={(e) =>
                        setBookForm((f) => ({ ...f, edition: e.target.value }))
                      }
                      placeholder="Edition"
                    />
                    <Input
                      type="number"
                      value={bookForm.publication_year}
                      onChange={(e) =>
                        setBookForm((f) => ({
                          ...f,
                          publication_year: e.target.value,
                        }))
                      }
                      placeholder="Year"
                    />
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input
                    value={bookForm.description}
                    onChange={(e) =>
                      setBookForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="e.g. Approved MoE list 2025; used in Term 1"
                  />
                </div>

                <div className="sm:col-span-2 border-t pt-3 mt-1">
                  <p className="text-xs font-medium mb-2">
                    Physical copies (issued from the desk)
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Number of copies *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={bookForm.copies}
                    onChange={(e) =>
                      setBookForm((f) => ({ ...f, copies: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Accession prefix{" "}
                    {bookForm.mode === "textbook" && (
                      <span className="text-muted-foreground font-normal">
                        (auto from grade-subject if empty)
                      </span>
                    )}
                  </Label>
                  <Input
                    value={bookForm.accession_prefix}
                    onChange={(e) =>
                      setBookForm((f) => ({
                        ...f,
                        accession_prefix: e.target.value,
                      }))
                    }
                    placeholder="e.g. G4-MATH-"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Storage / shelf</Label>
                  <Input
                    value={bookForm.storage_location}
                    onChange={(e) =>
                      setBookForm((f) => ({
                        ...f,
                        storage_location: e.target.value,
                      }))
                    }
                    placeholder="Textbook store · Shelf B2"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">How acquired</Label>
                  <Input
                    value={bookForm.acquisition_source}
                    onChange={(e) =>
                      setBookForm((f) => ({
                        ...f,
                        acquisition_source: e.target.value,
                      }))
                    }
                    placeholder="MoE supply, purchase, parent contribution…"
                  />
                </div>
                <div className="sm:col-span-2 flex gap-2 pt-2">
                  <Button onClick={addBook} disabled={savingBook}>
                    {savingBook ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    {bookForm.mode === "textbook"
                      ? "Save textbook to school stock"
                      : "Save to library catalogue"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBookForm(emptyBookForm());
                      setShowBookForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grouped by grade for textbooks */}
          {catView !== "general" && booksByGrade.length > 0 ? (
            <div className="space-y-4">
              {booksByGrade.map(([grade, items]) => (
                <Card key={grade} className="rounded-xl">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">
                      {grade}{" "}
                      <span className="text-muted-foreground font-normal text-sm">
                        ({items.length} title{items.length !== 1 ? "s" : ""})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {items.map((b) => (
                        <li
                          key={`${grade}-${b.id}`}
                          className="px-4 py-3 flex flex-wrap justify-between gap-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">{b.title}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-slate-600">
                                {b.subject || "—"}
                              </span>
                              {" · "}
                              {TEXTBOOK_KINDS.find(
                                (k) => k.value === b.category
                              )?.label ||
                                b.category ||
                                "Textbook"}
                              {b.publisher ? ` · ${b.publisher}` : ""}
                              {b.curriculum ? ` · ${b.curriculum}` : ""}
                              {b.isbn ? ` · ISBN ${b.isbn}` : ""}
                            </p>
                          </div>
                          <div className="text-xs text-right text-muted-foreground shrink-0">
                            <p>
                              {b.copies_available ?? "—"} /{" "}
                              {b.copies_total ?? "—"} available
                            </p>
                            <p className="text-[10px]">ready to issue</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">
                  {catView === "general"
                    ? "General library"
                    : "School catalogue"}{" "}
                  ({filteredBooks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y max-h-[480px] overflow-y-auto">
                  {filteredBooks.map((b) => (
                    <li
                      key={b.id}
                      className="px-4 py-3 flex flex-wrap justify-between gap-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{b.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[b.author, b.subject, b.category, b.publisher]
                            .filter(Boolean)
                            .join(" · ")}
                          {b.isbn ? ` · ISBN ${b.isbn}` : ""}
                        </p>
                      </div>
                      <div className="text-xs text-right text-muted-foreground">
                        <p>
                          {b.copies_available ?? "—"} / {b.copies_total ?? "—"}{" "}
                          available
                        </p>
                      </div>
                    </li>
                  ))}
                  {!filteredBooks.length && (
                    <li className="p-6 text-center text-muted-foreground text-sm">
                      {catView === "textbooks"
                        ? "No school textbooks yet. Click “Add textbook” and set grade, subject, publisher and whether it is a core book or revision material."
                        : "No titles in this view."}
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== MANAGE DIGITAL ========== */}
      {tab === "digital-manage" && isStaff && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload resource
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Title *</Label>
                <Input
                  value={uploadForm.title}
                  onChange={(e) =>
                    setUploadForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input
                  value={uploadForm.subject}
                  onChange={(e) =>
                    setUploadForm((f) => ({ ...f, subject: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Author</Label>
                <Input
                  value={uploadForm.author}
                  onChange={(e) =>
                    setUploadForm((f) => ({ ...f, author: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grade levels</Label>
                <Input
                  value={uploadForm.grade_levels}
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      grade_levels: e.target.value,
                    }))
                  }
                  placeholder="e.g. 4,5"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">External URL (optional)</Label>
                <Input
                  value={uploadForm.external_url}
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      external_url: e.target.value,
                    }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">File (PDF, EPUB, image, media)</Label>
                <Input
                  type="file"
                  accept=".pdf,.epub,.png,.jpg,.jpeg,.webp,.mp3,.mp4,.doc,.docx"
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      file: e.target.files?.[0] || null,
                    }))
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={uploadForm.allow_download}
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      allow_download: e.target.checked,
                    }))
                  }
                />
                Allow learners to download
              </label>
              <Button className="w-full" onClick={uploadDigital}>
                Upload
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Same title + file/URL is blocked to avoid double-adding.
                Librarians auto-approve; teacher uploads stay Pending until
                approved.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl lg:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Digital inventory</CardTitle>
              <div className="flex flex-wrap gap-1">
                {["", "PENDING", "APPROVED", "REJECTED"].map((f) => (
                  <button
                    key={f || "all"}
                    type="button"
                    onClick={() => setDigitalFilter(f)}
                    className={`rounded-md px-2 py-1 text-xs ${
                      digitalFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-100 hover:bg-slate-200"
                    }`}
                  >
                    {f || "All"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y max-h-[520px] overflow-y-auto">
                {allDigital.map((r) => (
                  <li
                    key={r.id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.approval_status}
                        {r.allow_download ? " · downloadable" : " · online only"}
                        {r.subject ? ` · ${r.subject}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.approval_status !== "APPROVED" && (
                        <Button
                          size="sm"
                          onClick={() => approveDigital(String(r.id))}
                        >
                          Approve
                        </Button>
                      )}
                      {r.approval_status !== "REJECTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectDigital(String(r.id))}
                        >
                          Reject
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openReader(String(r.id), r.title, r.external_url)
                        }
                      >
                        Preview
                      </Button>
                      {(r.approval_status === "REJECTED" ||
                        r.approval_status === "PENDING") && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            deleteDigital(String(r.id), r.approval_status)
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {r.approval_status === "APPROVED" && isStaff && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() =>
                            deleteDigital(String(r.id), r.approval_status)
                          }
                          title="Librarian can remove approved items"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
                {!allDigital.length && (
                  <li className="p-6 text-center text-muted-foreground text-sm">
                    No digital resources
                    {digitalFilter ? ` with status ${digitalFilter}` : ""}.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== STOCK AUDIT ========== */}
      {tab === "stock-audit" && isStaff && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {stockSummary?.titles ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Titles</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {stockSummary?.copies_total ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Total copies</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {stockSummary?.available ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Available</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">
                  {stockSummary?.issued ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Issued</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Start stocktake
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name (optional)</Label>
                  <Input
                    value={stocktakeName}
                    onChange={(e) => setStocktakeName(e.target.value)}
                    placeholder={`Stocktake ${new Date().toISOString().slice(0, 10)}`}
                  />
                </div>
                <Button onClick={startStocktake} className="w-full">
                  Open new stocktake
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Walk shelves and scan or type each accession number. Close
                  when finished to mark unscanned copies as missing.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Scan during stocktake</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeStocktake ? (
                  <>
                    <p className="text-sm">
                      Active:{" "}
                      <span className="font-medium">
                        {activeStocktake.name}
                      </span>
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs">Accession number</Label>
                      <Input
                        value={scanAccession}
                        onChange={(e) => setScanAccession(e.target.value)}
                        placeholder="Scan or type accession"
                        onKeyDown={(e) => e.key === "Enter" && scanCopy()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={scanCopy}>Record found</Button>
                      <Button
                        variant="outline"
                        onClick={() => closeStocktake(String(activeStocktake.id))}
                      >
                        Close stocktake
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    No open stocktake. Start one to begin scanning.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Recent stocktakes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y max-h-[280px] overflow-y-auto">
                {stocktakes.map((t) => (
                  <li
                    key={t.id}
                    className="px-4 py-3 flex flex-wrap justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.status}
                        {t.started_at
                          ? ` · started ${String(t.started_at).slice(0, 10)}`
                          : ""}
                      </p>
                    </div>
                    {t.status === "OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveStocktake(t)}
                      >
                        Resume
                      </Button>
                    )}
                  </li>
                ))}
                {!stocktakes.length && (
                  <li className="p-6 text-center text-muted-foreground text-sm">
                    No stocktakes yet
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
