"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { cn } from "@/lib/utils";
import { Application, classAppliedId, classAppliedName } from "@/types/admission";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onEnrolled?: (student: { id: string; full_name: string; admission_number: string }) => void;
}

interface ClassLogisticsStepProps {
  formData: Record<string, any>;
  applicationData: Application;
  updateForm: (field: string, value: any) => void;
  schoolHierarchy: "secondary" | "primary" | "simple";
  gradeLabel?: string;
}

// ─────────────────────────────────────────────────────────────
// Improved ClassLogisticsStep with clear Primary vs Secondary logic
// ─────────────────────────────────────────────────────────────
const ClassLogisticsStep = ({
  formData,
  applicationData,
  updateForm,
  schoolHierarchy,
  gradeLabel,
}: ClassLogisticsStepProps) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold">Class & Placement Logistics</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Class / Grade - Always required */}
      <div>
        <Label>Class / Grade *</Label>
        <Input
          value={
            gradeLabel ||
            classAppliedName(applicationData) ||
            (classAppliedId(applicationData) ? "Loading grade…" : "—")
          }
          disabled
        />
      </div>

      {/* Section - Common to both (Boys/Girls or Lower/Upper Primary) */}
      <div>
        <Label>Section *</Label>
        <Input
          value={formData.section ?? ""}
          onChange={(e) => updateForm("section", e.target.value)}
          placeholder={
            schoolHierarchy === "secondary"
              ? "Boys, Girls, Mixed..."
              : "Lower Primary, Upper Primary, Red House..."
          }
        />
        <p className="text-xs text-muted-foreground mt-1">
          {schoolHierarchy === "secondary" ? "Gender or house grouping" : "Primary level or house"}
        </p>
      </div>

      {/* ────── SECONDARY SCHOOL FIELDS ────── */}
      {schoolHierarchy === "secondary" && (
        <>
          <div>
            <Label>Pathway</Label>
            <Select
              value={formData.pathway ?? ""}
              onValueChange={(val) => {
                updateForm("pathway", val);
                updateForm("track", "");   // Reset dependent fields
                updateForm("stream", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Pathway (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STEM">STEM</SelectItem>
                <SelectItem value="ARTS">Arts</SelectItem>
                <SelectItem value="SOCIAL_SCIENCES">Social Sciences</SelectItem>
                <SelectItem value="TECHNICAL">Technical</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Senior secondary pathway (e.g. CBC)</p>
          </div>

          <div>
            <Label>Track</Label>
            <Input
              value={formData.track ?? ""}
              onChange={(e) => updateForm("track", e.target.value)}
              placeholder="e.g. Pure Sciences, Engineering, Humanities, Business..."
              disabled={!formData.pathway}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Specific track under the selected pathway
            </p>
          </div>
        </>
      )}

      {/* ────── STREAM FIELD - Different meaning per school type ────── */}
      <div>
        <Label>
          {schoolHierarchy === "secondary" ? "Stream (Class Division)" : "Stream"}
        </Label>
        <Input
          value={formData.stream ?? ""}
          onChange={(e) => updateForm("stream", e.target.value)}
          placeholder={
            schoolHierarchy === "secondary"
              ? "e.g. Blue, Orange, Green, 10A..."
              : "e.g. Green, Orange, A, B, Red..."
          }
        />
        <p className="text-xs text-muted-foreground mt-1">
          {schoolHierarchy === "secondary"
            ? "Final division/stream within track (e.g. Grade 10 Blue)"
            : "Used to divide classes in primary (e.g. Grade 1 Green / Grade 1 Orange)"}
        </p>
      </div>

      {/* Boarding Status */}
      <div>
        <Label>Boarding Status *</Label>
        <Select
          value={formData.boarding_status}
          onValueChange={(val) => {
            updateForm("boarding_status", val);
            if (val !== "BOARDING") {
              updateForm("house", "");
              updateForm("dorm_room", "");
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DAY">Day Scholar</SelectItem>
            <SelectItem value="BOARDING">Boarding</SelectItem>
            <SelectItem value="MIXED">Mixed (Boarding/Day)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.boarding_status === "BOARDING" && (
        <>
          <div>
            <Label>House *</Label>
            <Input
              value={formData.house ?? ""}
              onChange={(e) => updateForm("house", e.target.value)}
              placeholder="e.g. Lions, Eagles, Unity House"
            />
          </div>
          <div>
            <Label>Dorm Room *</Label>
            <Input
              value={formData.dorm_room ?? ""}
              onChange={(e) => updateForm("dorm_room", e.target.value)}
              placeholder="e.g. Dorm A – Room 101"
            />
          </div>
        </>
      )}

      {/* Transport Mode - unchanged */}
      <div>
        <Label>Transport Mode</Label>
        <Select
          value={formData.transport_mode}
          onValueChange={(val) => updateForm("transport_mode", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="walking">Walking</SelectItem>
            <SelectItem value="private">Private / Parent</SelectItem>
            <SelectItem value="school_bus">School Bus</SelectItem>
            <SelectItem value="public">Public Transport</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.transport_mode === "school_bus" && (
        <div>
          <Label>Bus Route / Stop</Label>
          <Input
            value={String(formData.transport_route ?? "")}
            onChange={(e) => updateForm("transport_route", e.target.value)}
            placeholder="e.g. Route 3 - Westlands Stop"
          />
        </div>
      )}
    </div>
  </div>
);

export default function EnrollmentWizardModal({
  open,
  onOpenChange,
  applicationId,
  applicationData,
  onEnrolled,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const [gradeLabel, setGradeLabel] = useState(() => {
    const n = classAppliedName(applicationData);
    // Prefer real names; bare numeric ids are resolved below
    return n && !/^\d+$/.test(n.trim()) ? n : "";
  });

  const today = format(new Date(), "yyyy-MM-dd");

  const { currentSchool } = useCurrentSchool();

  // ────── SCHOOL HIERARCHY CONFIGURATION ──────
  const schoolHierarchy = useMemo<"secondary" | "primary" | "simple">(() => {
    const hierarchy = (currentSchool as any)?.hierarchy_mode;
    if (hierarchy === "primary" || hierarchy === "simple") {
      return hierarchy;
    }
    return "secondary";
  }, [currentSchool]);

  // Resolve grade label + ensure current_class is set as soon as wizard opens
  useEffect(() => {
    if (!open) return;

    const id = classAppliedId(applicationData);
    const existing =
      classAppliedName(applicationData) ||
      (applicationData as any)?.class_applied_name ||
      "";

    // Always re-bind class id into form when opening / when application data arrives
    if (id) {
      setFormData((prev) =>
        String(prev.current_class || "") === String(id)
          ? prev
          : { ...prev, current_class: String(id) }
      );
    }

    if (existing && !/^\d+$/.test(String(existing).trim())) {
      setGradeLabel(String(existing));
      return;
    }

    if (!id) {
      setGradeLabel(existing || "");
      return;
    }

    let cancelled = false;

    const asList = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.results)) return data.results;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    };

    const resolveFromList = (list: any[]) => {
      const g = list.find((x: any) => String(x.id) === String(id));
      if (g?.name) {
        setGradeLabel(String(g.name));
        return true;
      }
      return false;
    };

    // Instant path: session cache from academics / prior fetches
    try {
      const cached = sessionStorage.getItem("grade_levels_cache_v1");
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list) && resolveFromList(list)) {
          // still refresh in background below
        }
      }
    } catch {
      /* ignore */
    }

    (async () => {
      try {
        // Prefer detail endpoint (fast) then fall back to list
        try {
          const one = await api.get(`/academics/grade-levels/${id}/`, {
            timeout: 8000,
            headers: currentSchool?.id
              ? { "X-School-ID": String(currentSchool.id) }
              : undefined,
          });
          if (!cancelled && one.data?.name) {
            setGradeLabel(String(one.data.name));
            return;
          }
        } catch {
          /* list fallback */
        }

        const res = await api.get("/academics/grade-levels/", {
          timeout: 10000,
          headers: currentSchool?.id
            ? { "X-School-ID": String(currentSchool.id) }
            : undefined,
        });
        if (cancelled) return;
        const list = asList(res.data);
        try {
          sessionStorage.setItem("grade_levels_cache_v1", JSON.stringify(list));
        } catch {
          /* ignore */
        }
        if (!resolveFromList(list)) {
          setGradeLabel(existing || "");
        }
      } catch {
        if (!cancelled) setGradeLabel(existing || "");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, applicationData, currentSchool?.id]);

  // When wizard opens, re-sync key admission fields and edit baseline
  useEffect(() => {
    if (!open || !applicationData) return;
    const name =
      classAppliedName(applicationData) ||
      (applicationData as any).class_applied_name ||
      "";
    if (name && !/^\d+$/.test(String(name).trim())) {
      setGradeLabel(String(name));
    }
    setFormData((prev) => {
      const next = {
        ...prev,
        current_class: classAppliedId(applicationData) || prev.current_class || "",
        guardian_name:
          prev.guardian_name ||
          applicationData.primary_guardian_name ||
          "",
        guardian_phone:
          prev.guardian_phone ||
          applicationData.primary_guardian_phone ||
          "",
        guardian_email:
          prev.guardian_email ||
          applicationData.primary_guardian_email ||
          "",
        guardian_relationship:
          prev.guardian_relationship ||
          applicationData.primary_guardian_relationship ||
          "Parent",
        guardian_national_id:
          prev.guardian_national_id ||
          (applicationData as any).primary_guardian_id_number ||
          "",
        secondary_guardian_name:
          prev.secondary_guardian_name ||
          (applicationData as any).secondary_guardian_name ||
          "",
        secondary_guardian_phone:
          prev.secondary_guardian_phone ||
          (applicationData as any).secondary_guardian_phone ||
          "",
        secondary_guardian_email:
          prev.secondary_guardian_email ||
          (applicationData as any).secondary_guardian_email ||
          "",
        secondary_guardian_national_id:
          prev.secondary_guardian_national_id ||
          (applicationData as any).secondary_guardian_id_number ||
          "",
      };
      // baseline after sync
      setTimeout(() => snapshotBaseline(next), 0);
      return next;
    });
    setCurrentStep(1);
  }, [open, applicationData?.id, (applicationData as any)?.class_applied, (applicationData as any)?.class_applied_name]);