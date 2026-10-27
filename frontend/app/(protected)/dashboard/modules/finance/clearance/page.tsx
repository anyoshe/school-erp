"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Banknote, Plus } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function FinanceClearancePage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;
  const qc = useQueryClient();

  const [payOpen, setPayOpen] = useState(false);
  const [row, setRow] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [addingExtra, setAddingExtra] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState<
    Array<{
      id: string;
      description: string;
      category?: string;
      amount: number;
      original_amount?: number;
      discount_amount?: number;
      is_waived?: boolean;
    }>
  >([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loadingLines, setLoadingLines] = useState(false);
  const [adjustingLine, setAdjustingLine] = useState<string | null>(null);
  const [structureCandidates, setStructureCandidates] = useState<any[]>([]);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [pickingStructure, setPickingStructure] = useState(false);

  const listQ = useQuery({
    queryKey: ["awaiting-clearance", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/awaiting-clearance/", { headers });
      return asList(res.data?.results ?? res.data);
    },
  });

  const structureLabel = (r: any) => {
    const named = String(r?.structure?.name || "").trim();
    // Backend already sends a single clean "Grade · Term N · Year"
    if (named && (named.includes("·") || /Term\s*[123]/i.test(named))) {
      return named;
    }
    const grade = r?.structure?.grade || r?.grade || "";
    let term = String(
      r?.structure?.period_name || r?.matched_term || r?.structure?.term || ""
    ).trim();
    let year = String(
      r?.structure?.academic_year || r?.matched_year || r?.structure?.year || ""
    ).trim();
    // Strip duplicated "Term" fragments inside term field
    const tm = term.match(/Term\s*([123])/i);
    if (tm) term = `Term ${tm[1]}`;
    const ym = year.match(/(20\d{2})/);
    if (ym) year = ym[1];
    // If term already embeds year, don't add year again
    if (term && year && term.includes(year)) year = "";
    const parts = [grade, term, year].filter((x) => x && String(x).trim());
    if (parts.length) return parts.join(" · ");
    return String(r?.structure?.raw_name || named || "").trim();
  };

  const mapLines = (lines: any[]) =>
    (lines || []).map((ln: any) => ({
      id: String(ln.id || ln.line_id || ""),
      description: ln.description || ln.item_name || "Fee item",
      category: ln.category_name || ln.category || "",
      amount: Number(ln.amount || 0),
      original_amount: Number(ln.original_amount ?? ln.amount ?? 0),
      discount_amount: Number(ln.discount_amount || 0),
      is_waived: Boolean(ln.is_waived),
    })).filter((ln) => ln.id && ln.id !== "undefined");

  const applyBilling = (billing: any, r: any) => {
    const invs = billing?.invoices || [];
    const iid = invs[0] ? String(invs[0].id) : "";
    setInvoiceId(iid);
    const mapped = mapLines(billing?.lines || []);
    setInvoiceLines(mapped);
    const bal = Number(billing?.balance ?? r?.balance ?? 0);
    const due = Number(billing?.total_due ?? r?.total_due ?? 0);
    const payAmt = bal > 0 ? bal : due > 0 ? due : 0;
    setAmount(payAmt > 0 ? String(payAmt) : "");
    const err = billing?.error || null;
    setBillingError(err);
    setStructureCandidates(Array.isArray(billing?.candidates) ? billing.candidates : []);
    if (err) toast.message(String(err));
    // Immediate proportional allocation (don't wait for effect)
    if (payAmt > 0 && mapped.length > 0) {
      const weights = mapped.map((l) =>
        l.is_waived ? 0 : Math.max(0, Number(l.amount) || Number(l.original_amount) || 0)
      );
      const totalW = weights.reduce((s, w) => s + w, 0) || 1;
      let remaining = payAmt;
      const next: Record<string, string> = {};
      const active = weights.map((w, i) => (w > 0 ? i : -1)).filter((i) => i >= 0);
      mapped.forEach((ln, i) => {
        if (weights[i] <= 0) {
          next[ln.id] = "0";
          return;
        }
        if (i === active[active.length - 1]) {
          next[ln.id] = String(Math.round(remaining * 100) / 100);
        } else {
          const share = Math.round((weights[i] / totalW) * payAmt * 100) / 100;
          next[ln.id] = String(share);
          remaining -= share;
        }
      });
      setAllocations(next);
    } else {
      setAllocations({});
    }
    setRow({
      ...r,
      ...billing,
      invoices: invs,
      lines: billing?.lines || [],
      total_due: due,
      balance: bal,
      structure: billing?.structure || r?.structure,
      matched_term: billing?.matched_term || billing?.structure?.period_name,
      matched_year: billing?.matched_year || billing?.structure?.academic_year,
    });
  };

  const loadInvoiceLines = async (id: string) => {
    if (!id) {
      setInvoiceLines([]);
      setAllocations({});
      return;
    }
    setLoadingLines(true);
    try {
      const res = await api.get(`/finance/invoices/${id}/`, { headers });
      setInvoiceLines(mapLines(Array.isArray(res.data?.lines) ? res.data.lines : []));
      setAllocations({});
    } catch {
      setInvoiceLines([]);
    } finally {
      setLoadingLines(false);
    }
  };

  const openPay = async (r: any, structureId?: string) => {
    setRow(r);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("CASH");
    setReference("");
    setExtraName("");
    setExtraAmount("");
    setInvoiceId("");
    setInvoiceLines([]);
    setAllocations({});
    setBillingError(null);
    setStructureCandidates([]);
    setPayOpen(true);
    setLoadingLines(true);
    try {
      const res = await api.get(`/finance/awaiting-clearance/${r.id}/prepare/`, {
        headers,
        params: structureId ? { structure_id: structureId } : undefined,
      });
      applyBilling(res.data, r);
      if (!res.data?.structure && !(res.data?.lines || []).length) {
        // Fallback: load all school structures for manual pick
        try {
          const sres = await api.get("/finance/structures/", {
            headers,
            params: r.grade_id ? { grade_level: r.grade_id } : undefined,
          });
          const list = Array.isArray(sres.data)
            ? sres.data
            : sres.data?.results || [];
          if (list.length) {
            setStructureCandidates(
              list.map((s: any) => ({
                id: String(s.id),
                name: s.name,
                academic_year: s.academic_year,
                period_name: s.period_name,
                grade: s.grade_level?.name || s.grade_level_name || r.grade,
                is_active: s.is_active !== false,
              }))
            );
          }
        } catch {
          /* ignore */
        }
      }
    } catch (e: any) {
      toast.error(
        e?.response?.data?.detail || "Could not prepare billing for this student"
      );
      setAmount(r.balance > 0 ? String(r.balance) : "");
    } finally {
      setLoadingLines(false);
    }
  };

  const assignStructure = async (structureId: string) => {
    if (!row?.id) return;
    setPickingStructure(true);
    try {
      await openPay(row, structureId);
      toast.success("Fee structure applied");
    } finally {
      setPickingStructure(false);
    }
  };

  const adjustLine = async (
    lineId: string,
    payload: { waived?: boolean; discount?: number; reason?: string }
  ) => {
    setAdjustingLine(lineId);
    try {
      const res = await api.patch(
        `/finance/clearance/lines/${lineId}/`,
        payload,
        { headers }
      );
      if (res.data?.billing) {
        applyBilling(res.data.billing, row || {});
      } else if (res.data?.line) {
        setInvoiceLines((prev) =>
          prev.map((ln) =>
            ln.id === lineId
              ? {
                  ...ln,
                  amount: Number(res.data.line.amount),
                  original_amount: Number(res.data.line.original_amount),
                  discount_amount: Number(res.data.line.discount_amount),
                  is_waived: Boolean(res.data.line.is_waived),
                }
              : ln
          )
        );
        if (res.data?.invoice) {
          const bal = Number(res.data.invoice.balance || 0);
          setAmount(bal > 0 ? String(bal) : "0");
        }
      }
      toast.success(payload.waived ? "Line waived" : "Line updated");
      qc.invalidateQueries({ queryKey: ["awaiting-clearance"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Adjustment failed");
    } finally {
      setAdjustingLine(null);
    }
  };

  const allocTotal = Object.values(allocations).reduce(
    (s, v) => s + (Number(v) || 0),
    0
  );

  const applyProportional = () => {
    const bal =
      Number(row?.balance) ||
      invoiceLines.reduce((s, l) => s + (l.is_waived ? 0 : Number(l.amount) || 0), 0);
    const amt = Number(amount) > 0 ? Number(amount) : bal;
    if (amt <= 0 || invoiceLines.length === 0) return;
    if (!(Number(amount) > 0)) setAmount(String(amt));
    // Weight by current billed amount; waived (0) lines get 0 share
    const weights = invoiceLines.map((l) => {
      if (l.is_waived) return 0;
      const w = Number(l.amount) > 0 ? Number(l.amount) : Number(l.original_amount || 0);
      return Math.max(0, w);
    });
    const billTotal = weights.reduce((s, w) => s + w, 0);
    const next: Record<string, string> = {};
    if (billTotal <= 0) {
      // Equal split across all lines as last resort
      const n = invoiceLines.length;
      let remaining = amt;
      invoiceLines.forEach((ln, i) => {
        if (i === n - 1) next[ln.id] = String(Math.round(remaining * 100) / 100);
        else {
          const share = Math.round((amt / n) * 100) / 100;
          next[ln.id] = String(share);
          remaining -= share;
        }
      });
      setAllocations(next);
      return;
    }
    let remaining = amt;
    const activeIdx = weights.map((w, i) => (w > 0 ? i : -1)).filter((i) => i >= 0);
    invoiceLines.forEach((ln, i) => {
      if (weights[i] <= 0) {
        next[ln.id] = "0";
        return;
      }
      const isLast = i === activeIdx[activeIdx.length - 1];
      if (isLast) {
        next[ln.id] = String(Math.round(remaining * 100) / 100);
      } else {
        const share = Math.round((weights[i] / billTotal) * amt * 100) / 100;
        next[ln.id] = String(share);
        remaining -= share;
      }
    });
    setAllocations(next);
  };

  const applyToFirst = () => {
    const bal =
      Number(row?.balance) ||
      invoiceLines.reduce((s, l) => s + (l.is_waived ? 0 : Number(l.amount) || 0), 0);
    const amt = Number(amount) > 0 ? Number(amount) : bal;
    if (amt <= 0 || invoiceLines.length === 0) return;
    if (!(Number(amount) > 0)) setAmount(String(amt));
    const next: Record<string, string> = {};
    invoiceLines.forEach((ln, i) => {
      next[ln.id] = i === 0 ? String(amt) : "0";
    });
    setAllocations(next);
  };

  // Auto-split when amount received or line amounts change
  useEffect(() => {
    if (!payOpen) return;
    const amt = Number(amount) || 0;
    if (amt <= 0 || invoiceLines.length === 0) return;
    applyProportional();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, invoiceLines, payOpen]);

  const addExtra = async () => {
    if (!row?.id) return;
    if (!extraName.trim() || !extraAmount || Number(extraAmount) <= 0) {
      toast.error("Enter item name and amount");
      return;
    }
    setAddingExtra(true);
    try {
      const res = await api.post(
        `/finance/awaiting-clearance/${row.id}/add-item/`,
        { description: extraName.trim(), amount: extraAmount },
        { headers }
      );
      const billing = res.data?.billing;
      if (billing) {
        setRow((prev: any) => ({
          ...prev,
          ...billing,
          structure: billing.structure ?? prev.structure,
          lines: billing.lines ?? prev.lines,
          invoices: billing.invoices ?? prev.invoices,
          total_due: billing.total_due,
          total_paid: billing.total_paid,
          balance: billing.balance,
        }));
        setAmount(String(billing.balance ?? billing.total_due ?? ""));
        if (billing.invoices?.[0]) setInvoiceId(String(billing.invoices[0].id));
      }
      setExtraName("");
      setExtraAmount("");
      toast.success("Extra fee item added");
      qc.invalidateQueries({ queryKey: ["awaiting-clearance"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not add item");
    } finally {
      setAddingExtra(false);
    }
  };

  const submit = async () => {
    if (!paymentDate) {
      toast.error("Payment date is required");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter amount received");
      return;
    }
    if (!invoiceId) {
      toast.error("No invoice — create a fee structure for this grade, then reopen");
      return;
    }
    setSaving(true);
    try {
      const amt = Number(amount);
      const line_allocations = invoiceLines
        .map((ln) => ({
          line_id: ln.id,
          description: ln.description,
          category: ln.category || "",
          amount: Number(allocations[ln.id] || 0),
        }))
        .filter((r) => r.amount > 0);
      if (line_allocations.length > 0) {
        const sum = line_allocations.reduce((s, r) => s + r.amount, 0);
        if (Math.abs(sum - amt) > 0.05) {
          toast.error(
            `Allocation total (${sum.toLocaleString()}) must equal payment (${amt.toLocaleString()}).`
          );
          setSaving(false);
          return;
        }
      }
      const res = await api.post(
        "/finance/payments/",
        {
          invoice: invoiceId,
          amount: amt,
          payment_method: method,
          payment_date: paymentDate,
          reference_number: reference,
          notes: `Finance clearance — ${row?.admission_number || ""}`,
          ...(line_allocations.length ? { line_allocations } : {}),
        },
        { headers }
      );
      toast.success(
        `Payment recorded${res.data?.receipt_number ? ` · ${res.data.receipt_number}` : ""}`
      );
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ["awaiting-clearance"] });
      qc.invalidateQueries({ queryKey: ["owner-standing"] });
    } catch (e: any) {
      const d = e?.response?.data;
      toast.error(
        d?.payment_date?.[0] || d?.detail || (typeof d === "object" ? JSON.stringify(d) : "Payment failed")
      );
    } finally {
      setSaving(false);
    }
  };

  const rows = listQ.data || [];
  const totalDue = useMemo(
    () => rows.reduce((s: number, r: any) => s + Number(r.balance || 0), 0),
    [rows]
  );

  const lines = row?.lines || [];
  const invoices = row?.invoices || [];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/modules/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
        </Button>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Banknote className="h-6 w-6 text-emerald-700" />
            Awaiting finance clearance
          </h1>
          <p className="text-sm text-muted-foreground">
            Fees load from the structure for the learner&apos;s grade, year and term. Add extra items
            (uniform, assessment book, etc.) before receiving payment.
          </p>
        </div>
      </div>

      <Card className="border-amber-100 bg-amber-50/50">
        <CardContent className="p-4 flex flex-wrap justify-between items-center gap-3">
          <span className="text-sm font-medium">Learners waiting</span>
          <span className="text-lg font-bold">{rows.length}</span>
          <span className="text-sm text-muted-foreground ml-auto">Open balances</span>
          <span className="text-lg font-bold">
            {currency} {totalDue.toLocaleString()}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-slate-50/80">
          <CardTitle className="text-base">Clearance queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading clearance queue…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No one awaiting clearance.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="py-3 px-4">Admission #</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Grade</th>
                    <th className="py-3 px-4">Structure</th>
                    <th className="py-3 px-4 text-right">Expected</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs">{r.admission_number}</td>
                      <td className="py-3 px-4 font-medium">{r.full_name}</td>
                      <td className="py-3 px-4">{r.grade || "—"}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-[220px]">
                        {structureLabel(r) || (
                          r.total_due > 0 || r.balance > 0 ? (
                            <span className="text-slate-500">Billed</span>
                          ) : (
                            <span className="text-rose-600">No structure for grade</span>
                          )
                        )}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {Number(r.total_due || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        {Number(r.balance || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" className="bg-emerald-600 text-white" onClick={() => openPay(r)}>
                          Receive payment
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

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {(billingError || (!row?.structure && structureCandidates.length > 0)) && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
            <p className="font-medium text-amber-900">
              {billingError || "Select the fee structure for this learner"}
            </p>
            <p className="text-xs text-amber-800">
              Grade: {row?.grade || "—"} · Term/year from enrollment will be used when available.
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {structureCandidates.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={pickingStructure}
                  onClick={() => void assignStructure(String(s.id))}
                  className="w-full text-left rounded-md border bg-white px-3 py-2 text-xs hover:border-primary hover:bg-primary/5"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {s.grade || "?"} · {s.period_name} · {s.academic_year}
                    {s.is_active === false ? " (inactive)" : ""}
                  </span>
                </button>
              ))}
            </div>
            {!structureCandidates.length && (
              <p className="text-xs text-amber-900">
                No structures found. Create one under Finance → Fee structures for this grade.
              </p>
            )}
          </div>
        )}

          <DialogHeader>
            <DialogTitle>
              Clearance — {row?.admission_number} {row?.full_name}
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Grade:</span> {row?.grade || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Structure:</span>{" "}
              {structureLabel(row) || "Not found — create fee structure for this grade"}
            </p>
            <p>
              <span className="text-muted-foreground">Period:</span>{" "}
              {row?.matched_term || "—"} / {row?.matched_year || "—"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Expected fee lines</p>
            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No lines yet. Ensure a fee structure exists for this grade/year/term.
              </p>
            ) : (
              <ul className="text-sm border rounded-lg divide-y max-h-40 overflow-y-auto">
                {lines.map((ln: any) => (
                  <li key={ln.line_id} className="flex justify-between px-3 py-1.5">
                    <span>{ln.description}</span>
                    <span className="font-medium tabular-nums">
                      {Number(ln.amount || 0).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm font-semibold mt-2 flex justify-between">
              <span>Balance due</span>
              <span>
                {currency} {Number(row?.balance ?? 0).toLocaleString()}
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-emerald-300 p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <Plus className="h-4 w-4" /> Add extra fee item
            </p>
            <p className="text-xs text-muted-foreground">
              e.g. Assessment book, uniform — for items not on the term structure.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 sm:col-span-1">
                <Label>Item name</Label>
                <Input
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  placeholder="Assessment book"
                />
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={extraAmount}
                  onChange={(e) => setExtraAmount(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={addingExtra}
              onClick={addExtra}
            >
              {addingExtra ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to bill"}
            </Button>
          </div>


          {invoiceId && (
            <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <p className="text-sm font-medium">Allocate to fee items</p>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={applyProportional}>
                    Split by ratio
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={applyToFirst}>
                    First item
                  </Button>
                </div>
              </div>
              {loadingLines ? (
                <p className="text-xs text-muted-foreground">Preparing fee lines…</p>
              ) : invoiceLines.length === 0 ? (
                <p className="text-xs text-muted-foreground">No line items.</p>
              ) : (
                <ul className="space-y-3">
                  {invoiceLines.map((ln) => (
                    <li key={ln.id} className="rounded-lg border bg-white p-2 space-y-1.5">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium truncate">{ln.description}</span>
                        <span className="tabular-nums shrink-0 text-right">
                          {ln.is_waived ? (
                            <span className="text-emerald-700">Waived</span>
                          ) : (
                            Number(ln.amount).toLocaleString()
                          )}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!ln.is_waived}
                            disabled={adjustingLine === ln.id}
                            onChange={(e) =>
                              void adjustLine(ln.id, {
                                waived: e.target.checked,
                                reason: e.target.checked ? "Waived at clearance" : "",
                              })
                            }
                          />
                          Waive
                        </label>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">Discount</span>
                          <Input
                            className="h-7 w-24"
                            type="number"
                            min={0}
                            disabled={!!ln.is_waived || adjustingLine === ln.id}
                            defaultValue={ln.discount_amount || ""}
                            key={`${ln.id}-disc-${ln.discount_amount}-${ln.is_waived}`}
                            onChange={(e) => {
                              // Live: amount due = original - discount
                              const d = Number(e.target.value || 0);
                              if (Number.isNaN(d)) return;
                              const orig = Number(ln.original_amount ?? ln.amount ?? 0);
                              const nextAmt = Math.max(0, orig - d);
                              setInvoiceLines((prev) =>
                                prev.map((x) =>
                                  x.id === ln.id
                                    ? {
                                        ...x,
                                        discount_amount: d,
                                        amount: nextAmt,
                                      }
                                    : x
                                )
                              );
                            }}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v === "" || v == null) return;
                              const d = Number(v);
                              if (Number.isNaN(d)) return;
                              void adjustLine(ln.id, {
                                waived: false,
                                discount: d,
                                reason: d > 0 ? "Discount at clearance" : "",
                              });
                            }}
                          />
                        </div>
                        <Input
                          className="h-7 w-24 ml-auto"
                          type="number"
                          placeholder="Pay"
                          value={allocations[ln.id] ?? ""}
                          onChange={(e) =>
                            setAllocations((prev) => ({
                              ...prev,
                              [ln.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Allocated {allocTotal.toLocaleString()}
                {amount ? ` / ${Number(amount).toLocaleString()}` : ""}
              </p>
            </div>
          )}

          <div className="space-y-3 border-t pt-3">
            <div>
              <Label>Payment date *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Invoice / term bill *</Label>
              <Select
                value={invoiceId || "none"}
                onValueChange={(v) => { const id = v === "none" ? "" : v; setInvoiceId(id); void loadInvoiceLines(id); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {invoices.map((inv: any) => (
                    <SelectItem key={inv.id} value={String(inv.id)}>
                      {inv.invoice_number} · {inv.term || "Term"} · bal{" "}
                      {Number(inv.balance ?? 0).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount received *</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="M-PESA">M-Pesa</SelectItem>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              className="bg-emerald-600 text-white"
              onClick={submit}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
