"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  RefreshCw,
  Users,
  Banknote,
  CalendarDays,
  Pencil,
} from "lucide-react";

type StaffMember = {
  id: string;
  full_name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  role_display?: string;
  department?: string;
  job_title?: string;
  employee_number?: string;
  phone?: string;
  hire_date?: string | null;
  exit_date?: string | null;
  is_active?: boolean;
  notes?: string;
  employment_type?: string;
  employment_type_display?: string;
  gender?: string;
  national_id?: string;
  tsc_number?: string;
  bank_name?: string;
  bank_account?: string;
  next_of_kin?: string;
  next_of_kin_phone?: string;
  default_basic_salary?: string | number;
  default_allowances?: string | number;
  default_deductions?: string | number;
  default_fee_category?: string | null;
  default_expense_category?: string | null;
};

type PayrollRow = {
  id: string;
  staff: string;
  staff_name?: string;
  staff_role?: string;
  basic_salary: string | number;
  allowances: string | number;
  deductions: string | number;
  net_salary: string | number;
  month: string;
  status: string;
  status_display?: string;
  paid_at?: string | null;
  notes?: string;
  related_fee_category?: string | null;
  related_fee_category_name?: string | null;
  expense_category?: string | null;
  expense_category_name?: string | null;
};

type LeaveRow = {
  id: string;
  staff: string;
  staff_name?: string;
  leave_type: string;
  leave_type_display?: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: string;
  status_display?: string;
  review_notes?: string;
};

const ROLES = [
  { value: "TEACHER", label: "Teacher" },
  { value: "PRINCIPAL", label: "Principal / Head" },
  { value: "ADMIN", label: "Admin / Office" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "SUPPORT", label: "Support staff" },
  { value: "OTHER", label: "Other" },
];

const EMPLOYMENT = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACT", label: "Contract" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "INTERN", label: "Intern / Volunteer" },
];

const LEAVE_TYPES = [
  { value: "ANNUAL", label: "Annual leave" },
  { value: "SICK", label: "Sick leave" },
  { value: "MATERNITY", label: "Maternity" },
  { value: "PATERNITY", label: "Paternity" },
  { value: "COMPASSIONATE", label: "Compassionate" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OTHER", label: "Other" },
];

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "TEACHER",
  department: "",
  job_title: "",
  employee_number: "",
  hire_date: "",
  exit_date: "",
  is_active: true,
  notes: "",
  password: "",
  employment_type: "PERMANENT",
  gender: "",
  national_id: "",
  tsc_number: "",
  bank_name: "",
  bank_account: "",
  next_of_kin: "",
  next_of_kin_phone: "",
  default_basic_salary: "",
  default_allowances: "0",
  default_deductions: "0",
  default_fee_category: "",
  default_expense_category: "",
};

function money(n: string | number | undefined) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function HRPage() {
  const { currentSchool } = useCurrentSchool();
  const [tab, setTab] = useState<"directory" | "payroll" | "leave">("directory");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    active: number;
    teachers: number;
    on_leave_today?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [teachingLoad, setTeachingLoad] = useState<{
    subject_assignments: any[];
    class_sections: any[];
  } | null>(null);

  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    staff: "",
    month: "",
    basic_salary: "",
    allowances: "0",
    deductions: "0",
    notes: "",
  });

  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    staff: "",
    leave_type: "ANNUAL",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [payMethod, setPayMethod] = useState("BANK");
  const [runMonth, setRunMonth] = useState("");
  const [payslip, setPayslip] = useState<any>(null);
  const [feeCategories, setFeeCategories] = useState<{ id: string | number; name: string }[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<{ id: string | number; name: string }[]>([]);
  const [feeCategoryId, setFeeCategoryId] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (q.trim()) params.q = q.trim();
      if (roleFilter) params.role = roleFilter;
      if (activeOnly) params.is_active = "true";
      const [listRes, sumRes] = await Promise.all([
        api.get("/staff/staff/", { params }),
        api.get("/staff/staff/summary/"),
      ]);
      const list = listRes.data?.results ?? listRes.data;
      setStaff(Array.isArray(list) ? list : []);
      setSummary(sumRes.data);
    } catch {
      toast.error("Could not load staff");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter, activeOnly]);

  const loadFinanceCats = useCallback(async () => {
    try {
      const [feeRes, expRes] = await Promise.all([
        api.get("/finance/categories/"),
        api.get("/finance/expense-categories/"),
      ]);
      const fees = feeRes.data?.results ?? feeRes.data;
      const exps = expRes.data?.results ?? expRes.data;
      setFeeCategories(Array.isArray(fees) ? fees : []);
      setExpenseCategories(Array.isArray(exps) ? exps : []);
    } catch {
      /* optional */
    }
  }, []);

  const loadPayroll = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (runMonth) params.month = runMonth;
      const [listRes, sumRes, feeRes, expRes] = await Promise.all([
        api.get("/staff/payroll/", { params }),
        api.get("/staff/payroll/summary/", { params }),
        api.get("/finance/categories/"),
        api.get("/finance/expense-categories/"),
      ]);
      const list = listRes.data?.results ?? listRes.data;
      setPayroll(Array.isArray(list) ? list : []);
      setPayrollSummary(sumRes.data);
      const fees = feeRes.data?.results ?? feeRes.data;
      const exps = expRes.data?.results ?? expRes.data;
      setFeeCategories(Array.isArray(fees) ? fees : []);
      setExpenseCategories(Array.isArray(exps) ? exps : []);
      // Prefer Staff salaries as default expense category once
      if (!expenseCategoryId && Array.isArray(exps)) {
        const sal = exps.find((c: any) => /salar/i.test(c.name || ""));
        if (sal) setExpenseCategoryId(String(sal.id));
      }
    } catch {
      toast.error("Could not load payroll");
      setPayroll([]);
    }
  }, [expenseCategoryId]);

  const loadLeave = useCallback(async () => {
    try {
      const { data } = await api.get("/staff/leave/");
      const list = data?.results ?? data;
      setLeaves(Array.isArray(list) ? list : []);
    } catch {
      toast.error("Could not load leave");
      setLeaves([]);
    }
  }, [runMonth]);

  useEffect(() => {
    if (!currentSchool?.id) return;
    loadStaff();
  }, [currentSchool?.id, loadStaff]);

  useEffect(() => {
    if (!currentSchool?.id) return;
    loadFinanceCats();
    if (tab === "payroll") loadPayroll();
    if (tab === "leave") loadLeave();
  }, [tab, currentSchool?.id, loadPayroll, loadLeave, loadFinanceCats]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setTeachingLoad(null);
    setOpen(true);
  };

  const openEdit = async (s: StaffMember) => {
    setEditing(s);
    setForm({
      first_name: s.first_name || "",
      last_name: s.last_name || "",
      email: s.email || "",
      phone: s.phone || "",
      role: s.role || "TEACHER",
      department: s.department || "",
      job_title: s.job_title || "",
      employee_number: s.employee_number || "",
      hire_date: s.hire_date || "",
      exit_date: s.exit_date || "",
      is_active: s.is_active !== false,
      notes: s.notes || "",
      password: "",
      employment_type: s.employment_type || "PERMANENT",
      gender: s.gender || "",
      national_id: s.national_id || "",
      tsc_number: s.tsc_number || "",
      bank_name: s.bank_name || "",
      bank_account: s.bank_account || "",
      next_of_kin: s.next_of_kin || "",
      next_of_kin_phone: s.next_of_kin_phone || "",
      default_basic_salary: s.default_basic_salary != null ? String(s.default_basic_salary) : "",
      default_allowances: s.default_allowances != null ? String(s.default_allowances) : "0",
      default_deductions: s.default_deductions != null ? String(s.default_deductions) : "0",
      default_fee_category: s.default_fee_category ? String(s.default_fee_category) : "",
      default_expense_category: s.default_expense_category ? String(s.default_expense_category) : "",
    });
    setOpen(true);
    try {
      const { data } = await api.get(`/staff/staff/${s.id}/teaching-load/`);
      setTeachingLoad(data);
    } catch {
      setTeachingLoad(null);
    }
  };

  const saveStaff = async () => {
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        hire_date: form.hire_date || null,
        exit_date: form.exit_date || null,
        default_basic_salary: (form as any).default_basic_salary || 0,
        default_allowances: (form as any).default_allowances || 0,
        default_deductions: (form as any).default_deductions || 0,
        default_fee_category: (form as any).default_fee_category || null,
        default_expense_category: (form as any).default_expense_category || null,
      };
      if (!payload.password) delete payload.password;
      if (editing) {
        await api.patch(`/staff/staff/${editing.id}/`, payload);
        toast.success("Staff updated");
      } else {
        if (!payload.email) {
          toast.error("Email is required");
          setSaving(false);
          return;
        }
        await api.post("/staff/staff/", payload);
        toast.success("Staff created");
      }
      setOpen(false);
      loadStaff();
    } catch (e: any) {
      const d = e?.response?.data;
      toast.error(
        typeof d === "string"
          ? d
          : d?.email?.[0] || d?.detail || "Save failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const syncTeachers = async () => {
    try {
      const { data } = await api.post("/staff/staff/sync-teachers/");
      toast.success(`Synced teachers · new ${data.created || 0}, existing ${data.existing || 0}`);
      loadStaff();
    } catch {
      toast.error("Sync failed");
    }
  };

  const savePayroll = async () => {
    if (!payForm.staff || !payForm.month || !payForm.basic_salary) {
      toast.message("Staff, month and basic salary required");
      return;
    }
    setSaving(true);
    try {
      const month = payForm.month.length === 7 ? `${payForm.month}-01` : payForm.month;
      await api.post("/staff/payroll/", {
        staff: payForm.staff,
        month,
        basic_salary: payForm.basic_salary,
        allowances: payForm.allowances || 0,
        deductions: payForm.deductions || 0,
        notes: payForm.notes,
        status: "DRAFT",
      });
      toast.success("Payroll row saved");
      setPayOpen(false);
      setPayForm({ staff: "", month: "", basic_salary: "", allowances: "0", deductions: "0", notes: "" });
      loadPayroll();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (id: string) => {
    try {
      // Categories come from the payslip row (per staff). Global selects are fallback only.
      await api.post(`/staff/payroll/${id}/mark-paid/`, {
        payment_method: payMethod,
        related_fee_category: feeCategoryId || undefined,
        expense_category: expenseCategoryId || undefined,
      });
      toast.success("Paid · posted to Finance using this staff's fee group & expense class");
      loadPayroll();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not mark paid");
    }
  };

  const patchPayrollRow = async (id: string, patch: Record<string, any>) => {
    try {
      await api.patch(`/staff/payroll/${id}/`, patch);
      loadPayroll();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not update payslip");
    }
  };

  const runPayrollMonth = async (opts?: { pay?: boolean }) => {
    if (!runMonth) {
      toast.message("Choose a month (YYYY-MM)");
      return;
    }
    setSaving(true);
    try {
      const pay = opts?.pay !== false;
      const { data } = await api.post("/staff/payroll/run/", {
        month: runMonth,
        payment_method: payMethod,
        generate: true,
        pay,
        // Fallback only when a staff member has no personal fee/expense setting
        related_fee_category: feeCategoryId || undefined,
        expense_category: expenseCategoryId || undefined,
      });
      const skipped = data.skipped_already_paid || 0;
      const gen = data.generated || 0;
      toast.success(
        `${data.month}: ${gen} payslip(s) generated` +
          (pay ? ` · posted ${data.posted}` : " (not paid yet)") +
          (skipped ? ` · skipped ${skipped} already paid` : "") +
          (data.error_count ? ` · ${data.error_count} issue(s)` : "")
      );
      if (data.errors?.length) console.warn(data.errors);
      loadPayroll();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Payroll run failed");
    } finally {
      setSaving(false);
    }
  };

  const openPayslip = async (id: string) => {
    try {
      const { data } = await api.get(`/staff/payroll/${id}/payslip/`);
      setPayslip(data);
    } catch {
      toast.error("Could not load payslip");
    }
  };

  const saveLeave = async () => {
    if (!leaveForm.staff || !leaveForm.start_date || !leaveForm.end_date) {
      toast.message("Staff and dates required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/staff/leave/", leaveForm);
      toast.success("Leave request submitted");
      setLeaveOpen(false);
      setLeaveForm({ staff: "", leave_type: "ANNUAL", start_date: "", end_date: "", reason: "" });
      loadLeave();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.end_date?.[0] || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const reviewLeave = async (id: string, action: "approve" | "reject") => {
    try {
      await api.post(`/staff/leave/${id}/${action}/`);
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      loadLeave();
      loadStaff();
    } catch {
      toast.error("Action failed");
    }
  };

  const tabs = useMemo(
    () =>
      [
        { id: "directory" as const, label: "Directory", icon: Users },
        { id: "payroll" as const, label: "Payroll", icon: Banknote },
        { id: "leave" as const, label: "Leave", icon: CalendarDays },
      ] as const,
    []
  );

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Human resources</p>
          <h1 className="text-2xl font-bold">Staff, payroll & leave</h1>
          <p className="text-sm text-muted-foreground">
            {currentSchool?.name || "School"} · teachers feed Academics; payroll stays school-scoped
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === "directory" && (
            <>
              <Button variant="outline" size="sm" onClick={syncTeachers}>
                Sync teacher users
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Add staff
              </Button>
            </>
          )}
          {tab === "payroll" && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add pay row
            </Button>
          )}
          {tab === "leave" && (
            <Button size="sm" onClick={() => setLeaveOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Request leave
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total staff</p>
            <p className="text-2xl font-bold">{summary?.total ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-emerald-700">{summary?.active ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Teachers</p>
            <p className="text-2xl font-bold text-primary">{summary?.teachers ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">On leave today</p>
            <p className="text-2xl font-bold">{summary?.on_leave_today ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "directory" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Staff directory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[12rem]">
                <Label className="text-xs">Search</Label>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Name, email, TSC, employee no…"
                />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <select
                  className="mt-1 h-10 rounded-md border px-3 text-sm min-w-[9rem]"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All roles</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm h-10 px-2">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                />
                Active only
              </label>
              <Button variant="outline" onClick={loadStaff}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : staff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No staff yet. Add teachers and office staff so Academics can assign classes.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Employment</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">TSC / ID</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2 font-medium">
                          {s.full_name || "—"}
                          {s.job_title ? (
                            <span className="block text-xs text-muted-foreground font-normal">
                              {s.job_title}
                              {s.department ? ` · ${s.department}` : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{s.role_display || s.role}</td>
                        <td className="px-3 py-2 text-xs">
                          {s.employment_type_display || s.employment_type || "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">{s.phone || "—"}</td>
                        <td className="px-3 py-2 text-xs font-mono">
                          {s.tsc_number || s.national_id || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              s.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "payroll" && (
        <Card>
          <CardHeader className="pb-2 space-y-3">
            <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Monthly payslips</CardTitle>
              {payrollSummary && (
                <p className="text-sm text-muted-foreground">
                  Net total: <strong>KSh {money(payrollSummary.total_net)}</strong> ·{" "}
                  {payrollSummary.count || 0} rows
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-end print:hidden">
              <div>
                <Label className="text-xs">Pay from (cash pot)</Label>
                <select
                  className="h-9 border rounded-md px-2 text-sm min-w-[7rem]"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="BANK">Bank</option>
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Fallback fee group (only if staff has none)</Label>
                <select
                  className="h-9 border rounded-md px-2 text-sm min-w-[9rem]"
                  value={feeCategoryId}
                  onChange={(e) => setFeeCategoryId(e.target.value)}
                >
                  <option value="">— optional —</option>
                  {feeCategories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Fallback expense class (only if staff has none)</Label>
                <select
                  className="h-9 border rounded-md px-2 text-sm min-w-[9rem]"
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                >
                  <option value="">Staff salaries (default)</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Run month</Label>
                <Input
                  type="month"
                  className="h-9"
                  value={runMonth}
                  onChange={(e) => setRunMonth(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => runPayrollMonth({ pay: false })}
              >
                Generate payslips
              </Button>
              <Button size="sm" disabled={saving} onClick={() => runPayrollMonth({ pay: true })}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Generate + pay unpaid
              </Button>
              <p className="text-xs text-muted-foreground max-w-md self-center">
                Standing salaries create one payslip per staff for the month. Fee group and expense class
                are per staff (not one for everyone). Already-paid rows are never paid twice.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2 text-right">Basic</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2">Fee group</th>
                    <th className="px-3 py-2">Expense class</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{p.staff_name}</td>
                      <td className="px-3 py-2 text-xs">{String(p.month).slice(0, 7)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(p.basic_salary)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {money(p.net_salary)}
                      </td>
                      <td className="px-3 py-2">
                        {p.status === "PAID" ? (
                          <span className="text-xs text-muted-foreground">
                            {p.related_fee_category_name || "—"}
                          </span>
                        ) : (
                          <select
                            className="h-8 max-w-[140px] rounded border px-1 text-xs"
                            value={p.related_fee_category ? String(p.related_fee_category) : ""}
                            onChange={(e) =>
                              patchPayrollRow(p.id, {
                                related_fee_category: e.target.value || null,
                              })
                            }
                          >
                            <option value="">— fee group —</option>
                            {feeCategories.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.status === "PAID" ? (
                          <span className="text-xs text-muted-foreground">
                            {p.expense_category_name || "—"}
                          </span>
                        ) : (
                          <select
                            className="h-8 max-w-[140px] rounded border px-1 text-xs"
                            value={p.expense_category ? String(p.expense_category) : ""}
                            onChange={(e) =>
                              patchPayrollRow(p.id, {
                                expense_category: e.target.value || null,
                              })
                            }
                          >
                            <option value="">— expense class —</option>
                            {expenseCategories.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.status_display || p.status}</td>
                      <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                        {p.status !== "PAID" && (
                          <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>
                            Mark paid
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openPayslip(p.id)}>
                          Payslip
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!payroll.length && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                        No payslips for this view. Set standing salaries on each staff profile, pick a month, then Generate payslips.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "leave" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leave requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Dates</th>
                    <th className="px-3 py-2">Days</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2 font-medium">
                        {l.staff_name}
                        {l.reason ? (
                          <span className="block text-xs text-muted-foreground font-normal line-clamp-1">
                            {l.reason}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs">{l.leave_type_display || l.leave_type}</td>
                      <td className="px-3 py-2 text-xs">
                        {l.start_date} → {l.end_date}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{l.days}</td>
                      <td className="px-3 py-2 text-xs">{l.status_display || l.status}</td>
                      <td className="px-3 py-2 text-right space-x-1">
                        {l.status === "PENDING" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => reviewLeave(l.id, "approve")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => reviewLeave(l.id, "reject")}>
                              Reject
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!leaves.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        No leave requests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit staff" : "Add staff"}</DialogTitle>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 py-2">
            <div>
              <Label>First name</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Email {!editing && "*"}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="w-full h-10 border rounded-md px-2 text-sm"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Employment type</Label>
              <select
                className="w-full h-10 border rounded-md px-2 text-sm"
                value={form.employment_type}
                onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
              >
                {EMPLOYMENT.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Gender</Label>
              <select
                className="w-full h-10 border rounded-md px-2 text-sm"
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <Label>Job title</Label>
              <Input
                value={form.job_title}
                onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              />
            </div>
            <div>
              <Label>Employee number</Label>
              <Input
                value={form.employee_number}
                onChange={(e) => setForm((f) => ({ ...f, employee_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>TSC number</Label>
              <Input
                value={form.tsc_number}
                onChange={(e) => setForm((f) => ({ ...f, tsc_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>National ID</Label>
              <Input
                value={form.national_id}
                onChange={(e) => setForm((f) => ({ ...f, national_id: e.target.value }))}
              />
            </div>
            <div>
              <Label>Hire date</Label>
              <Input
                type="date"
                value={form.hire_date}
                onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Exit date</Label>
              <Input
                type="date"
                value={form.exit_date}
                onChange={(e) => setForm((f) => ({ ...f, exit_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Bank name</Label>
              <Input
                value={form.bank_name}
                onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Bank account</Label>
              <Input
                value={form.bank_account}
                onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))}
              />
            </div>
            <div>
              <Label>Next of kin</Label>
              <Input
                value={form.next_of_kin}
                onChange={(e) => setForm((f) => ({ ...f, next_of_kin: e.target.value }))}
              />
            </div>
            <div>
              <Label>Next of kin phone</Label>
              <Input
                value={form.next_of_kin_phone}
                onChange={(e) => setForm((f) => ({ ...f, next_of_kin_phone: e.target.value }))}
              />
            </div>
            {!editing && (
              <div className="sm:col-span-2">
                <Label>Login password (optional — random if empty)</Label>
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            )}
            <div className="sm:col-span-2 rounded-lg border border-teal-100 bg-teal-50/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-teal-900">Standing monthly pay (auto payslips)</p>
              <p className="text-[11px] text-muted-foreground">
                Set salary once per staff. Each month, Generate payslips copies these amounts.
                Fee group and expense class are per person (e.g. teachers from Tuition, ICT from ICT — not one group for all).
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Basic</Label>
                  <Input
                    type="number"
                    value={(form as any).default_basic_salary || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, default_basic_salary: e.target.value } as any))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Allowances</Label>
                  <Input
                    type="number"
                    value={(form as any).default_allowances || "0"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, default_allowances: e.target.value } as any))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Deductions</Label>
                  <Input
                    type="number"
                    value={(form as any).default_deductions || "0"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, default_deductions: e.target.value } as any))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Paid from fee group</Label>
                  <select
                    className="w-full h-9 border rounded-md px-2 text-sm"
                    value={(form as any).default_fee_category || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, default_fee_category: e.target.value } as any))
                    }
                  >
                    <option value="">— select —</option>
                    {feeCategories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Expense class</Label>
                  <select
                    className="w-full h-9 border rounded-md px-2 text-sm"
                    value={(form as any).default_expense_category || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, default_expense_category: e.target.value } as any))
                    }
                  >
                    <option value="">— select —</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active (available for teaching / duties)
            </label>
          </div>
          {editing && teachingLoad && (
            <div className="rounded-xl border bg-slate-50 p-3 space-y-2 text-sm">
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Teaching load
              </p>
              {teachingLoad.class_sections?.length ? (
                <ul className="list-disc pl-5 text-xs">
                  {teachingLoad.class_sections.map((sec: any) => (
                    <li key={sec.id}>Section {sec.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Not a class teacher on any section.</p>
              )}
              {teachingLoad.subject_assignments?.length ? (
                <ul className="list-disc pl-5 text-xs max-h-28 overflow-y-auto">
                  {teachingLoad.subject_assignments.map((a: any) => (
                    <li key={a.id}>
                      {a.subject_name || "Subject"}
                      {a.grade_name ? ` · ${a.grade_name}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No subject assignments (set under Academics).</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={saveStaff}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payroll dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add payroll row</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Staff</Label>
              <select
                className="w-full h-10 border rounded-md px-2 text-sm"
                value={payForm.staff}
                onChange={(e) => setPayForm((f) => ({ ...f, staff: e.target.value }))}
              >
                <option value="">Select…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Month</Label>
              <Input
                type="month"
                value={payForm.month}
                onChange={(e) => setPayForm((f) => ({ ...f, month: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Basic</Label>
                <Input
                  type="number"
                  value={payForm.basic_salary}
                  onChange={(e) => setPayForm((f) => ({ ...f, basic_salary: e.target.value }))}
                />
              </div>
              <div>
                <Label>Allowances</Label>
                <Input
                  type="number"
                  value={payForm.allowances}
                  onChange={(e) => setPayForm((f) => ({ ...f, allowances: e.target.value }))}
                />
              </div>
              <div>
                <Label>Deductions</Label>
                <Input
                  type="number"
                  value={payForm.deductions}
                  onChange={(e) => setPayForm((f) => ({ ...f, deductions: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={payForm.notes}
                onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={savePayroll}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Staff</Label>
              <select
                className="w-full h-10 border rounded-md px-2 text-sm"
                value={leaveForm.staff}
                onChange={(e) => setLeaveForm((f) => ({ ...f, staff: e.target.value }))}
              >
                <option value="">Select…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="w-full h-10 border rounded-md px-2 text-sm"
                value={leaveForm.leave_type}
                onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start</Label>
                <Input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={saveLeave}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip print */}
      <Dialog open={!!payslip} onOpenChange={(o) => !o && setPayslip(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Payslip</DialogTitle>
          </DialogHeader>
          {payslip && (
            <div id="payslip-print" className="space-y-4 text-sm border rounded-xl p-5 bg-white">
              <div className="text-center border-b pb-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Payslip</p>
                <h2 className="text-lg font-bold">{payslip.school?.name}</h2>
                <p className="text-xs text-muted-foreground">{payslip.school?.address}</p>
                <p className="text-xs">{payslip.school?.phone} {payslip.school?.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Employee</p>
                  <p className="font-semibold">{payslip.employee?.name}</p>
                  <p className="text-xs">{payslip.employee?.job_title || payslip.employee?.role}</p>
                  <p className="text-xs">{payslip.employee?.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Pay period</p>
                  <p className="font-semibold">{payslip.pay?.month_label}</p>
                  <p className="text-xs font-mono">{payslip.pay?.reference}</p>
                  <p className="text-xs">Status: {payslip.pay?.status_display}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p>Emp no: {payslip.employee?.employee_number || "—"}</p>
                <p>TSC: {payslip.employee?.tsc_number || "—"}</p>
                <p>ID: {payslip.employee?.national_id || "—"}</p>
                <p>
                  Bank: {payslip.employee?.bank_name || "—"}{" "}
                  {payslip.employee?.bank_account ? `· ${payslip.employee.bank_account}` : ""}
                </p>
              </div>
              <table className="w-full text-sm border">
                <tbody>
                  <tr className="border-b">
                    <td className="px-3 py-2">Basic salary</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(payslip.pay?.basic_salary)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-3 py-2">Allowances</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(payslip.pay?.allowances)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-3 py-2">Deductions</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      ({money(payslip.pay?.deductions)})
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-3 py-2">Net pay</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      KSh {money(payslip.pay?.net_salary)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">
                Paid via {payslip.pay?.payment_method || "—"}
                {payslip.pay?.paid_at ? ` on ${payslip.pay.paid_at}` : " (not marked paid yet)"}
              </p>
              <p className="text-[11px] italic text-muted-foreground">{payslip.certification}</p>
            </div>
          )}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setPayslip(null)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>Print payslip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
