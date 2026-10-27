"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Loader2, CheckCircle2 } from "lucide-react";

export type ChargeType = "INTERVIEW" | "ADMISSION";

export type Charge = {
  id?: string;
  charge_type: ChargeType | string;
  policy: string;
  list_amount?: number | string;
  discount_amount?: number | string;
  amount_due?: number | string;
  amount_paid?: number | string;
  waiver_reason?: string;
  decision_made?: boolean;
  is_satisfied?: boolean;
};

type Props = {
  applicationId: string;
  types: ChargeType[];
  /** Charges already on the application — skip ensure-charges when usable */
  initialCharges?: Charge[] | null;
  currencySymbol?: string;
  compact?: boolean;
  title?: string;
  description?: string;
  required?: boolean;
  onSatisfiedChange?: (allSatisfied: boolean, charges: Charge[]) => void;
};

const LABELS: Record<string, string> = {
  INTERVIEW: "Interview fee",
  ADMISSION: "Admission / registration fee",
};

function filterTypes(all: Charge[], types: ChargeType[]) {
  return (all || []).filter((c) =>
    types.includes(String(c.charge_type).toUpperCase() as ChargeType)
  );
}

function isChargeSatisfied(c: Charge | undefined) {
  if (!c) return false;
  if (c.is_satisfied) return true;
  const policy = String(c.policy || "").toUpperCase();
  if (policy === "NOT_APPLICABLE" || policy === "WAIVED") return true;
  if (c.decision_made && Number(c.amount_due || 0) <= 0) return true;
  if (Number(c.amount_paid || 0) >= Number(c.amount_due || 0) && Number(c.amount_due || 0) >= 0) {
    if (policy === "FULL" || policy === "DISCOUNTED") return Number(c.amount_paid || 0) > 0 || Number(c.amount_due || 0) === 0;
  }
  if (c.decision_made && (policy === "WAIVED" || policy === "NOT_APPLICABLE")) return true;
  return Boolean(c.decision_made && (policy === "WAIVED" || policy === "NOT_APPLICABLE"));
}

export default function ApplicationChargePanel({
  applicationId,
  types,
  initialCharges,
  currencySymbol = "KSh",
  compact = false,
  title = "Pre-enrollment charges",
  description,
  required = true,
  onSatisfiedChange,
}: Props) {
  const seeded = useMemo(
    () => filterTypes(initialCharges || [], types),
    [initialCharges, types]
  );

  const [loading, setLoading] = useState(seeded.length === 0);
  const [saving, setSaving] = useState<string | null>(null);
  const [charges, setCharges] = useState<Charge[]>(seeded);

  const load = useCallback(async () => {
    if (!applicationId) return;
    // If parent already passed decisions, do not hit ensure-charges
    if (seeded.length > 0) {
      setCharges(seeded);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(
        `/admissions/applications/${applicationId}/ensure-charges/`
      );
      const all: Charge[] = res.data?.charges || [];
      setCharges(filterTypes(all, types));
    } catch (e) {
      console.warn("ensure-charges", e);
      setCharges([]);
    } finally {
      setLoading(false);
    }
  }, [applicationId, types, seeded]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep in sync when parent application refetches with updated charges
  useEffect(() => {
    if (seeded.length > 0) {
      setCharges(seeded);
      setLoading(false);
    }
  }, [seeded]);

  const allSatisfied = useMemo(() => {
    if (types.length === 0) return true;
    return types.every((t) => {
      const c = charges.find(
        (x) => String(x.charge_type).toUpperCase() === t
      );
      return isChargeSatisfied(c);
    });
  }, [charges, types]);

  useEffect(() => {
    onSatisfiedChange?.(allSatisfied, charges);
  }, [allSatisfied, charges, onSatisfiedChange]);

  const updateCharge = async (ctype: string, payload: Record<string, any>) => {
    setSaving(ctype);
    try {
      const res = await api.patch(
        `/admissions/applications/${applicationId}/charges/${ctype}/`,
        payload
      );
      const updated = res.data;
      setCharges((prev) => {
        const next = prev.map((c) =>
          String(c.charge_type).toUpperCase() === ctype
            ? { ...c, ...updated }
            : c
        );
        // If type missing, append
        if (!next.some((c) => String(c.charge_type).toUpperCase() === ctype)) {
          next.push(updated);
        }
        return next;
      });
      toast.success("Charge updated");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not update charge");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading fee decisions…
      </div>
    );
  }

  // All already decided — show compact confirmation, no re-entry form
  if (allSatisfied && charges.length > 0) {
    return (
      <div
        className={
          compact
            ? "rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 space-y-1"
            : "rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2"
        }
      >
        <p className="text-sm font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {title} — already recorded
        </p>
        <ul className="text-xs text-emerald-900/90 space-y-1">
          {charges.map((c) => (
            <li key={String(c.charge_type)} className="flex justify-between gap-2">
              <span>{LABELS[String(c.charge_type).toUpperCase()] || c.charge_type}</span>
              <span className="font-medium">
                {String(c.policy || "").replace(/_/g, " ")}
                {Number(c.amount_paid || 0) > 0
                  ? ` · paid ${currencySymbol} ${Number(c.amount_paid).toLocaleString()}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
        {description ? (
          <p className="text-[11px] text-emerald-800/80">{description}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "rounded-lg border bg-slate-50 p-3 space-y-3"
          : "rounded-xl border bg-slate-50 p-4 space-y-3"
      }
    >
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        ) : null}
        {required && !allSatisfied ? (
          <p className="text-xs text-amber-700 mt-1">
            Choose Not applicable, Waived, Discounted, or Full (mark paid if due).
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {types.map((ctype) => {
          let c = charges.find(
            (x) => String(x.charge_type).toUpperCase() === ctype
          );
          if (!c) {
            c = {
              charge_type: ctype,
              policy: "",
              amount_due: 0,
              amount_paid: 0,
              decision_made: false,
            };
          }
          const satisfied = isChargeSatisfied(c);
          return (
            <div key={ctype} className="space-y-2 rounded-lg border bg-white p-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-sm font-medium">
                  {LABELS[ctype] || ctype}
                  {satisfied ? (
                    <span className="ml-2 text-xs text-emerald-700">✓ Done</span>
                  ) : null}
                </span>
                <Select
                  value={c.policy || undefined}
                  onValueChange={(policy) => {
                    void updateCharge(ctype, {
                      policy,
                      decision_made: true,
                      ...(policy === "WAIVED" || policy === "NOT_APPLICABLE"
                        ? { amount_due: 0, amount_paid: 0 }
                        : {}),
                    });
                  }}
                >
                  <SelectTrigger className="h-9 w-[200px] bg-white">
                    <SelectValue placeholder="Select decision…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_APPLICABLE">Not applicable</SelectItem>
                    <SelectItem value="FULL">Full amount due</SelectItem>
                    <SelectItem value="DISCOUNTED">Discounted</SelectItem>
                    <SelectItem value="WAIVED">Waived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                List {currencySymbol} {Number(c.list_amount || 0).toLocaleString()}
                {" · "}
                Due {currencySymbol} {Number(c.amount_due || 0).toLocaleString()}
                {Number(c.amount_paid) > 0
                  ? ` · Paid ${Number(c.amount_paid).toLocaleString()}`
                  : ""}
              </div>

              {(c.policy === "FULL" || c.policy === "DISCOUNTED") &&
                c.decision_made &&
                !satisfied && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Record payment amount</Label>
                      <Input
                        type="number"
                        className="h-9 bg-white"
                        defaultValue={Number(c.amount_due || 0)}
                        id={`stage-pay-${applicationId}-${ctype}`}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={saving === ctype}
                      onClick={() => {
                        const el = document.getElementById(
                          `stage-pay-${applicationId}-${ctype}`
                        ) as HTMLInputElement | null;
                        const amt = Number(el?.value || c.amount_due || 0);
                        void updateCharge(ctype, {
                          amount_paid: amt,
                          policy: c.policy,
                          decision_made: true,
                        });
                      }}
                    >
                      Mark paid
                    </Button>
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
