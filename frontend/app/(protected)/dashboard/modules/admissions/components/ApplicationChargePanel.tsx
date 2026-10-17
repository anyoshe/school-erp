"use client";

import { useCallback, useEffect, useState } from "react";
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

type Charge = {
  id?: string;
  charge_type: ChargeType | string;
  policy: string;
  list_amount?: number | string;
  discount_amount?: number | string;
  amount_due?: number | string;
  amount_paid?: number | string;
  waiver_reason?: string;
  is_satisfied?: boolean;
};

type Props = {
  applicationId: string;
  /** Which charges to show in this panel */
  types: ChargeType[];
  currencySymbol?: string;
  /** Compact layout for modals */
  compact?: boolean;
  title?: string;
  description?: string;
  onChargesChange?: (charges: Charge[]) => void;
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
  onChargesChange,
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
      setCharges(filtered.length ? filtered : all.filter((c) => types.includes(c.charge_type as ChargeType)));
      onChargesChange?.(all);
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

  const updateCharge = async (
    chargeType: string,
    payload: Record<string, unknown>
  ) => {
    setSaving(chargeType);
    try {
      const res = await api.patch(
        `/admissions/applications/${applicationId}/charges/${chargeType}/`,
        payload
      );
      setCharges((prev) => {
        const rest = prev.filter(
          (c) => String(c.charge_type).toUpperCase() !== chargeType.toUpperCase()
        );
        return [...rest, res.data];
      });
      toast.success(`${LABELS[chargeType] || chargeType} updated`);
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.detail || "Could not update charge"
      );
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

  if (!charges.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No charges configured. Set amounts under Settings → Admission numbers, or mark N/A here after reopening.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {(title || description) && (
        <div>
          {title ? (
            <h4 className="font-semibold text-sm text-slate-900">{title}</h4>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
      )}

      <div className="space-y-3">
        {types.map((ctype) => {
          const c = charges.find(
            (x) => String(x.charge_type).toUpperCase() === ctype
          );
          if (!c) return null;
          const satisfied = !!c.is_satisfied;
          return (
            <div
              key={ctype}
              className={`rounded-lg border p-3 space-y-2 ${
                satisfied
                  ? "bg-emerald-50/80 border-emerald-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-sm">{LABELS[ctype]}</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    satisfied
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {satisfied ? "Satisfied" : "Outstanding"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Select
                  value={c.policy}
                  disabled={saving === ctype}
                  onValueChange={(v) =>
                    updateCharge(ctype, {
                      policy: v,
                      waiver_reason:
                        v === "WAIVED" || v === "DISCOUNTED"
                          ? c.waiver_reason || "Staff adjustment"
                          : "",
                    })
                  }
                >
                  <SelectTrigger className="h-9 w-[180px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_APPLICABLE">Not applicable</SelectItem>
                    <SelectItem value="FULL">Full amount due</SelectItem>
                    <SelectItem value="DISCOUNTED">Discounted</SelectItem>
                    <SelectItem value="WAIVED">Waived</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm font-mono">
                  Due {currencySymbol}{" "}
                  {Number(c.amount_due || 0).toLocaleString()}
                  {Number(c.amount_paid) > 0
                    ? ` · Paid ${Number(c.amount_paid).toLocaleString()}`
                    : ""}
                </span>
              </div>

              {(c.policy === "FULL" || c.policy === "DISCOUNTED") &&
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
