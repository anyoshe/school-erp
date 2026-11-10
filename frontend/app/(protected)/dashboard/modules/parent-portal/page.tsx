"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Link2, UserPlus, ExternalLink } from "lucide-react";

export default function StaffParentPortalPage() {
  const { currentSchool } = useCurrentSchool();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    admission_number: "",
    email: "",
    full_name: "",
    phone: "",
    password: "",
  });
  const [lastInvite, setLastInvite] = useState<any>(null);

  const dirQ = useQuery({
    queryKey: ["parent-directory", currentSchool?.id, q],
    queryFn: async () => {
      const { data } = await api.get("/parent-portal/directory/", {
        params: q ? { q } : undefined,
      });
      return data as { count: number; links: any[] };
    },
    enabled: !!currentSchool?.id,
  });

  const inviteMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/parent-portal/invite/", {
        admission_number: form.admission_number.trim(),
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        password: form.password.trim() || undefined,
      });
      return data;
    },
    onSuccess: (data) => {
      setLastInvite(data);
      toast.success(
        data.user_created
          ? "Parent account created and linked"
          : data.link_created
            ? "Parent linked to student"
            : "Already linked"
      );
      qc.invalidateQueries({ queryKey: ["parent-directory"] });
      setForm((f) => ({ ...f, password: "" }));
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || "Invite failed");
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Parent access</p>
          <h1 className="text-2xl font-bold">Parent portal (school office)</h1>
          <p className="text-sm text-muted-foreground">
            Create parent logins, link them to admission numbers, and manage who can see fees, results and attendance.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/modules/parent">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Open parent view
          </Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Invite / link parent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Admission number *</Label>
              <Input
                placeholder="e.g. PSS-2026-0001"
                value={form.admission_number}
                onChange={(e) => setForm({ ...form, admission_number: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Parent email *</Label>
              <Input
                type="email"
                placeholder="parent@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input
                placeholder="Guardian full name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                placeholder="07…"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Password (optional)</Label>
              <Input
                type="text"
                placeholder="Leave blank to auto-generate"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                If blank and the account is new, a temporary password is generated once.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={
                inviteMut.isPending || !form.admission_number.trim() || !form.email.trim()
              }
              onClick={() => inviteMut.mutate()}
            >
              {inviteMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" /> Create / link parent
                </>
              )}
            </Button>

            {lastInvite?.temporary_password && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
                <p className="font-medium text-amber-900">Temporary password (show once)</p>
                <p className="font-mono text-base tracking-wide">{lastInvite.temporary_password}</p>
                <p className="text-xs text-amber-800">
                  Share securely with {lastInvite.parent_email}. Parent should change password after login.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Linked parents
              <span className="text-xs font-normal text-muted-foreground">
                ({dirQ.data?.count ?? 0})
              </span>
            </CardTitle>
            <Input
              className="max-w-[200px] h-8"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </CardHeader>
          <CardContent>
            {dirQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading directory…
              </div>
            ) : !(dirQ.data?.links || []).length ? (
              <p className="text-sm text-muted-foreground py-6">
                No parent links yet. Invite a parent using the form — they will see fees, results and attendance for that learner.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Parent</th>
                      <th className="py-2 pr-2">Student</th>
                      <th className="py-2 pr-2">Grade</th>
                      <th className="py-2">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dirQ.data!.links.map((row: any) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{row.parent_name}</div>
                          <div className="text-xs text-muted-foreground">{row.parent_email}</div>
                        </td>
                        <td className="py-2 pr-2">
                          <div>{row.student_name}</div>
                          <div className="text-xs text-muted-foreground">{row.admission_number}</div>
                        </td>
                        <td className="py-2 pr-2">{row.grade || "—"}</td>
                        <td className="py-2 text-muted-foreground">{row.parent_phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
