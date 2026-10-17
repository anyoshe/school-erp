"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import api from "@/utils/api";
import { toast } from "sonner";
import { Hash, Save, RefreshCw } from "lucide-react";
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

const FORMATS = [
  {
    value: "PREFIX_SEQ",
    label: "Prefix + sequence",
    example: (p: string, pad: number) => `${p || "PSS"}${"1".padStart(pad, "0")}`,
    help: "Best for most schools. Example: PSS001, PSS002",
  },
  {
    value: "YEAR_SEQ",
    label: "Year + sequence",
    example: (_p: string, pad: number) => `${new Date().getFullYear()}-${"1".padStart(pad, "0")}`,
    help: "Example: 2026-0001",
  },
  {
    value: "PREFIX_YEAR_SEQ",
    label: "Prefix + year + sequence",
    example: (p: string, pad: number) =>
      `${p || "PSS"}-${new Date().getFullYear()}-${"1".padStart(pad, "0")}`,
    help: "Example: PSS-2026-0001",
  },
  {
    value: "CUSTOM",
    label: "Manual entry only",
    example: () => "typed on enroll form",
    help: "Staff always type the admission number when enrolling",
  },
] as const;

export default function AdmissionNumbersSettingsPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool() as {
    currentSchool: any;
    refreshSchools?: () => Promise<void>;
  };

  const [format, setFormat] = useState("PREFIX_SEQ");
  const [prefix, setPrefix] = useState("PSS");
  const [padding, setPadding] = useState(3);
  const [interviewEnabled, setInterviewEnabled] = useState(false);
  const [interviewAmount, setInterviewAmount] = useState(0);
  const [admissionAmount, setAdmissionAmount] = useState(0);
  const [requireAdmission, setRequireAdmission] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool?.id) {
      setLoading(false);
      return;
    }
    setFormat(currentSchool.admission_number_format || "PREFIX_SEQ");
    setPrefix((currentSchool.admission_prefix || "PSS").toString());
    setPadding(Number(currentSchool.admission_seq_padding || 3));
    setInterviewEnabled(!!currentSchool.interview_fee_enabled);
    setInterviewAmount(Number(currentSchool.interview_fee_amount || 0));
    setAdmissionAmount(Number(currentSchool.admission_fee_amount || 0));
    setRequireAdmission(!!currentSchool.require_admission_fee_before_enroll);
    setLoading(false);
  }, [currentSchool?.id, currentSchool?.admission_number_format, currentSchool?.admission_prefix, currentSchool?.admission_seq_padding]);

  const preview = useMemo(() => {
    const def = FORMATS.find((f) => f.value === format) || FORMATS[0];
    const pad = Math.min(8, Math.max(1, Number(padding) || 3));
    const p = (prefix || "").trim().toUpperCase();
    return {
      first: def.example(p, pad),
      second: def.example(p, pad).replace(/(\d+)$/, (_, d) =>
        String(Number(d) + 1).padStart(d.length, "0")
      ),
      help: def.help,
    };
  }, [format, prefix, padding]);

  const save = async () => {
    if (!currentSchool?.id) {
      toast.error("No school selected");
      return;
    }
    if ((format === "PREFIX_SEQ" || format === "PREFIX_YEAR_SEQ") && !prefix.trim()) {
      toast.error("Enter a prefix (e.g. PSS)");
      return;
    }
    setSaving(true);
    try {
      await api.patch(
        `/schools/${currentSchool.id}/`,
        {
          admission_number_format: format,
          admission_prefix: prefix.trim().toUpperCase(),
          admission_seq_padding: Math.min(8, Math.max(1, Number(padding) || 3)),
          interview_fee_enabled: interviewEnabled,
          interview_fee_amount: interviewAmount,
          admission_fee_amount: admissionAmount,
          require_admission_fee_before_enroll: requireAdmission,
        },
        { headers: { "X-School-ID": currentSchool.id } }
      );
      toast.success("Admission number settings saved");
      if (refreshSchools) await refreshSchools();
    } catch (err: any) {
      const d = err?.response?.data;
      toast.error(
        d?.detail ||
          (typeof d === "object" ? JSON.stringify(d) : null) ||
          "Could not save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-muted-foreground flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Hash className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Admission numbers</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Each school sets its own style. Numbers stay unique inside that school only
          (e.g. your school: PSS001 — another school can use ABC001).
        </p>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-6">
        <div className="space-y-2">
          <Label>Number format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger>
              <SelectValue placeholder="Choose format" />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{preview.help}</p>
        </div>

        {(format === "PREFIX_SEQ" || format === "PREFIX_YEAR_SEQ") && (
          <div className="space-y-2">
            <Label>Prefix (school code)</Label>
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="PSS"
              className="font-mono uppercase max-w-xs"
              maxLength={12}
            />
            <p className="text-xs text-muted-foreground">
              Letters/numbers only. Example for Promise Springs: <span className="font-mono">PSS</span>
            </p>
          </div>
        )}

        {format !== "CUSTOM" && (
          <div className="space-y-2">
            <Label>Sequence digits</Label>
            <Input
              type="number"
              min={1}
              max={8}
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              className="max-w-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              3 → 001, 002 · 4 → 0001, 0002
            </p>
          </div>
        )}

        <div className="rounded-xl bg-slate-50 border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Preview
          </p>
          <p className="font-mono text-lg font-semibold text-primary">
            {preview.first}
            {format !== "CUSTOM" ? (
              <span className="text-slate-400 font-normal"> → {preview.second} → …</span>
            ) : null}
          </p>
        </div>

        <div className="border-t pt-6 space-y-4">
          <h2 className="font-semibold">Pre-enrollment fees</h2>
          <p className="text-xs text-muted-foreground">
            Used on enroll Step 6. Leave amounts at 0 to default charges to Not applicable (legacy applications can enroll).
          </p>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="int-en"
              checked={interviewEnabled}
              onChange={(e) => setInterviewEnabled(e.target.checked)}
            />
            <Label htmlFor="int-en">Enable interview fee</Label>
          </div>
          {interviewEnabled && (
            <div className="space-y-1">
              <Label>Interview fee amount</Label>
              <Input
                type="number"
                className="max-w-xs"
                value={interviewAmount}
                onChange={(e) => setInterviewAmount(Number(e.target.value))}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label>Admission / registration fee amount</Label>
            <Input
              type="number"
              className="max-w-xs"
              value={admissionAmount}
              onChange={(e) => setAdmissionAmount(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="req-adm"
              checked={requireAdmission}
              onChange={(e) => setRequireAdmission(e.target.checked)}
            />
            <Label htmlFor="req-adm">Block enroll until admission fee is paid/waived</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
