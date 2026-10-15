"use client";

import { useEffect, useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hash, Receipt, Save, Loader2, GraduationCap } from "lucide-react";

export default function AdmissionsSettingsPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    admission_prefix: "",
    admission_number_format: "YEAR_SEQ",
    admission_seq_padding: 4,
    assign_admission_number_on: "ENROLL",
    require_admission_fee_before_enroll: false,
    receipt_prefix: "",
  });

  useEffect(() => {
    if (!currentSchool) return;
    setForm({
      admission_prefix: (currentSchool as any).admission_prefix || "",
      admission_number_format: (currentSchool as any).admission_number_format || "YEAR_SEQ",
      admission_seq_padding: (currentSchool as any).admission_seq_padding ?? 4,
      assign_admission_number_on: (currentSchool as any).assign_admission_number_on || "ENROLL",
      require_admission_fee_before_enroll: !!(currentSchool as any).require_admission_fee_before_enroll,
      receipt_prefix: (currentSchool as any).receipt_prefix || "",
    });
  }, [currentSchool]);

  const preview = () => {
    const year = new Date().getFullYear();
    const pad = Math.max(1, Number(form.admission_seq_padding) || 4);
    const seq = "1".padStart(pad, "0");
    const prefix = (form.admission_prefix || "SCH").trim();
    switch (form.admission_number_format) {
      case "PREFIX_YEAR_SEQ":
        return `${prefix}-${year}-${seq}`;
        return `${prefix}-${seq}`;
      case "YEAR_SEQ":
        return `${year}-${seq}`;
      default:
        return `${prefix}-${year}-${seq}`;
    }
  };

  const receiptPreview = () => {
    const p = (form.receipt_prefix || `ADM-${form.admission_prefix || "SCH"}`).trim();
    return `${p}-20261015143022-ab12cd34`;
  };

  const save = async () => {
    if (!currentSchool?.id) return;
    setSaving(true);
    try {
      await api.patch(`/schools/${currentSchool.id}/`, {
        admission_prefix: form.admission_prefix,
        admission_number_format: form.admission_number_format,
        admission_seq_padding: Number(form.admission_seq_padding) || 4,
        assign_admission_number_on: form.assign_admission_number_on,
        require_admission_fee_before_enroll: form.require_admission_fee_before_enroll,
        receipt_prefix: form.receipt_prefix,
      });
      await refreshSchools();
      toast.success("Admissions settings saved");
    } catch (err: any) {
      toast.error("Failed to save", {
        description: err?.response?.data?.detail || "Check permissions and try again",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          Admissions settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Control how admission numbers and payment receipts are generated for this school.
          Official student IDs are created at enroll (recommended).
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Hash className="h-4 w-4 text-primary" /> Admission numbers
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Prefix</Label>
            <Input
              value={form.admission_prefix}
              onChange={(e) => setForm((f) => ({ ...f, admission_prefix: e.target.value }))}
              placeholder="e.g. KPS or SCH"
            />
            <p className="text-xs text-muted-foreground mt-1">School short code used in IDs</p>
          </div>
          <div>
            <Label>Sequence padding</Label>
            <Input
              type="number"
              min={2}
              max={8}
              value={form.admission_seq_padding}
              onChange={(e) =>
                setForm((f) => ({ ...f, admission_seq_padding: Number(e.target.value) || 4 }))
              }
            />
          </div>
          <div>
            <Label>Number format</Label>
            <Select
              value={form.admission_number_format}
              onValueChange={(v) => setForm((f) => ({ ...f, admission_number_format: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="YEAR_SEQ">Year + sequence (2026-0001)</SelectItem>
                <SelectItem value="PREFIX_YEAR_SEQ">Prefix + year + sequence</SelectItem>
                <SelectItem value="CUSTOM">Custom / manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assign number when</Label>
            <Select
              value={form.assign_admission_number_on}
              onValueChange={(v) => setForm((f) => ({ ...f, assign_admission_number_on: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENROLL">On enroll (recommended)</SelectItem>
                <SelectItem value="ACCEPT">When offer accepted</SelectItem>
                <SelectItem value="SUBMIT">When application submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Preview: </span>
          <span className="font-mono font-semibold text-primary-900">{preview()}</span>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Receipt className="h-4 w-4 text-secondary-600" /> Receipts & fees
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Receipt prefix</Label>
            <Input
              value={form.receipt_prefix}
              onChange={(e) => setForm((f) => ({ ...f, receipt_prefix: e.target.value }))}
              placeholder="e.g. RCP-KPS"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.require_admission_fee_before_enroll}
                onChange={(e) =>
                  setForm((f) => ({ ...f, require_admission_fee_before_enroll: e.target.checked }))
                }
              />
              Require admission fee before enroll
            </label>
          </div>
        </div>
        <div className="rounded-xl bg-secondary-50 border border-secondary-100 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Receipt preview: </span>
          <span className="font-mono font-semibold">{receiptPreview()}</span>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !currentSchool} className="min-w-[140px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
