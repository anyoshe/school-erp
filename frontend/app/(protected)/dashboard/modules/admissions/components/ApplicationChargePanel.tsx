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
import { Loader2 } from "lucide-react";

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
  currencySymbol?: string;
  compact?: boolean;
  title?: string;
  description?: string;
  /** When true, parent should block submit until all listed charges are satisfied */
  required?: boolean;
  onSatisfiedChange?: (allSatisfied: boolean, charges: Charge[]) => void;
};

const LABELS: Record<string, string> = {
  INTERVIEW: "Interview fee",
  ADMISSION: "Admission / registration fee",
};

export default function ApplicationChargePanel({
  applicationId,
  types,
  currencySymbol = "KSh",
  compact = false,
  title = "Pre-enrollment charges",
  description,
  required = true,
  onSatisfiedChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const res = await api.post(
        `/admissions/applications/${applicationId}/ensure-charges/`
      );
      const all: Charge[] = res.data?.charges || [];
      const filtered = all.filter((c) =>
        types.includes(String(c.charge_type).toUpperCase() as ChargeType)
      );
      setCharges(filtered);
    } catch (e) {
      console.warn("ensure-charges", e);
      setCharges([]);
    } finally {
      setLoading(false);
    }
  }, [applicationId, types]);

  useEffect(() => {
    load();
  }, [load]);

  const allSatisfied = useMemo(() => {
    if (types.length === 0) return true;
    return types.every((t) => {
      const c = charges.find(
        (x) => String(x.charge_type).toUpperCase() === t
      );
      return !!c?.is_satisfied;
    });
  }, [charges, types]);

  useEffect(() => {
    onSatisfiedChange?.(allSatisfied, charges);
  }, [allSatisfied, charges, onSatisfiedChange]);

  const updateCharge = async (
    chargeType: string,
    payload: Record<string, unknown>
  ) => {
    setSaving(chargeType);
    try {
      await api.patch(
        `/admissions/applications/${applicationId}/charges/${chargeType}/`,
        { ...payload, decision_made: true }
      );
      toast.success(`${LABELS[chargeType] || chargeType} updated`);
      await load();
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
        Loading fee options…
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {(title || description) && (
        <div>
          {title ? (
            <h4 className="font-semibold text-sm text-slate-900">
              {title}
              {required ? (
                <span className="text-red-600 font-bold"> *</span>
              ) : null}
            </h4>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          ) : null}
          {required && !allSatisfied && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-2">
              Required: choose Not applicable, Waived, Discounted, or Full — and mark paid if money is due — before you can continue.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {types.map((ctype) => {
          const c = charges.find(
            (x) => String(x.charge_type).toUpperCase() === ctype
          );
          if (!c) {
            return (
              <p key={ctype} className="text-sm text-muted-foreground">
                {LABELS[ctype]} not created yet — reopen this step.
              </p>
            );
          }
          const satisfied = !!c.is_satisfied;
          return (
            <div
              key={ctype}
              className={`rounded-lg border p-3 space-y-2 ${
                satisfied
                  ? "bg-emerald-50/80 border-emerald-200"
                  : "bg-amber-50/40 border-amber-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-sm">
                  {LABELS[ctype]}
                  {required ? <span className="text-red-600"> *</span> : null}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    satisfied
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {satisfied
                    ? "Decided ✓"
                    : c.decision_made
                      ? "Outstanding payment"
                      : "Not decided yet"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Select
                  value={c.decision_made ? c.policy : undefined}
                  disabled={saving === ctype}
                  onValueChange={(v) =>
                    updateCharge(ctype, {
                      policy: v,
                      waiver_reason:
                        v === "WAIVED" || v === "DISCOUNTED"
                          ? c.waiver_reason || "Staff decision"
                          : "",
                    })
                  }
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
                <span className="text-sm font-mono">
                  List {currencySymbol}{" "}
                  {Number(c.list_amount || 0).toLocaleString()}
                  {" · "}
                  Due {currencySymbol}{" "}
                  {Number(c.amount_due || 0).toLocaleString()}
                  {Number(c.amount_paid) > 0
                    ? ` · Paid ${Number(c.amount_paid).toLocaleString()}`
                    : ""}
                </span>
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
                        updateCharge(ctype, {
                          amount_paid: amt,
                          policy: c.policy,
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
