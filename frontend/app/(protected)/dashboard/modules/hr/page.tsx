"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Loader2,
  Search,
  UserCheck,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type StaffMember = {
  id: string;
  user_email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  role_display?: string;
  department?: string;
  job_title?: string;
  employee_number?: string;
  phone?: string;
  hire_date?: string | null;
  is_active?: boolean;
  notes?: string;
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
  is_active: true,
  notes: "",
  password: "",
};

export default function HRPage() {
  const { currentSchool } = useCurrentSchool();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    active: number;
    teachers: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
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

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setForm({
      first_name: s.first_name || "",
      last_name: s.last_name || "",
      email: s.user_email || "",
      phone: s.phone || "",
      role: s.role || "TEACHER",
      department: s.department || "",
      job_title: s.job_title || "",
      employee_number: s.employee_number || "",
      hire_date: s.hire_date || "",
      is_active: s.is_active !== false,
      notes: s.notes || "",
      password: "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) {
      toast.message("Enter a name");
      return;
    }
    if (!editing && !form.email.trim()) {
      toast.message("Email is required for new staff");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        department: form.department.trim(),
        job_title: form.job_title.trim(),
        employee_number: form.employee_number.trim(),
        hire_date: form.hire_date || null,
        is_active: form.is_active,
        notes: form.notes.trim(),
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.password.trim()) payload.password = form.password.trim();

      if (editing) {
        await api.patch(`/staff/staff/${editing.id}/`, payload);
        toast.success("Staff updated");
      } else {
        await api.post("/staff/staff/", payload);
        toast.success("Staff member added");
      }
      setOpen(false);
      load();
    } catch (err: any) {
      const d = err?.response?.data;
      const msg =
        typeof d === "string"
          ? d
          : d?.email?.[0] || d?.detail || d?.first_name?.[0] || "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const syncTeachers = async () => {
    try {
      const { data } = await api.post("/staff/staff/sync-teachers/");
      toast.success(
        data.created
          ? `Linked ${data.created} teacher account(s)`
          : "Teacher list already up to date"
      );
      load();
    } catch {
      toast.error("Sync failed");
    }
  };

  const teachers = useMemo(
    () => staff.filter((s) => s.role === "TEACHER" && s.is_active !== false),
    [staff]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-textPrimary tracking-tight">
            Human Resource Management
          </h1>
          <p className="text-textMuted mt-2">
            Staff and teachers for {currentSchool?.name || "your school"}. Teachers
            appear in Academic Management for subject allocation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={syncTeachers}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync teacher users
          </Button>
          <Button className="bg-primary" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add staff
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total staff", value: summary?.total ?? "—", icon: Users },
          { label: "Active", value: summary?.active ?? "—", icon: UserCheck },
          { label: "Teachers", value: summary?.teachers ?? "—", icon: Briefcase },
          {
            label: "In this list",
            value: staff.length,
            icon: Search,
          },
        ].map((c) => (
          <Card key={c.label} className="border-border rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className="h-8 w-8 text-primary/70" />
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold tabular-nums">
                  {loading && c.label !== "In this list" ? "…" : c.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Staff directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[12rem]">
              <Label className="text-xs">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Name, email, phone…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
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
            <Button variant="outline" onClick={load}>
              Refresh
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
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Email</th>
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
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {s.role_display || s.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{s.department || "—"}</td>
                      <td className="px-3 py-2">{s.phone || "—"}</td>
                      <td className="px-3 py-2 text-xs">{s.user_email || "—"}</td>
                      <td className="px-3 py-2">
                        {s.is_active !== false ? (
                          <span className="text-emerald-700 text-xs font-medium">Active</span>
                        ) : (
                          <span className="text-slate-500 text-xs">Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                          Edit
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

      {teachers.length > 0 && (
        <Card className="border-border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Teachers (for Academics)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Active teachers available under Academic Management → Teachers for subject
              allocation.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {teachers.map((t) => (
                <Badge key={t.id} variant="outline" className="py-1 px-3">
                  {t.full_name || t.user_email}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit staff" : "Add staff member"}</DialogTitle>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
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
              <Label>Email {editing ? "" : "*"}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={!!editing}
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
                className="w-full h-10 rounded-md border px-3 text-sm"
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
              <Label>Job title</Label>
              <Input
                value={form.job_title}
                onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                placeholder="e.g. Class teacher"
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
              <Label>Employee #</Label>
              <Input
                value={form.employee_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, employee_number: e.target.value }))
                }
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
            {!editing && (
              <div className="sm:col-span-2">
                <Label>Login password (optional)</Label>
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Auto-generated if left blank"
                />
              </div>
            )}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Save changes" : "Add staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
