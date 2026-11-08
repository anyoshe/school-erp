"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight, RefreshCw, Wallet } from "lucide-react";
import api from "@/utils/api";
import { useCurrentSchool } from "@/app/contexts/CurrentSchoolContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FinanceNavLinks } from "../components/FinanceNav";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function ReconcilePage() {
  const { currentSchool } = useCurrentSchool();
  const schoolId = currentSchool?.id;
  const currency = currentSchool?.currency_symbol || currentSchool?.currency || "KES";
  const headers = schoolId ? { "X-School-ID": String(schoolId) } : undefined;
  const qc = useQueryClient();

  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const dataQ = useQuery({
    queryKey: ["internal-transfers", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const res = await api.get("/finance/internal-transfers/", { headers });
      return res.data as {
        accounts: { id: string; code: string; name: string; balance: number }[];
        transfers: any[];
      };
    },
    staleTime: 15_000,
  });

  const accounts = dataQ.data?.accounts || [];
  const transfers = dataQ.data?.transfers || [];

  // Prefill common evening flow: Cash → Bank when both exist
  useEffect(() => {
    if (!accounts.length) return;
    if (!fromAccount) {
      const cash = accounts.find((a) => a.code === "1000") || accounts[0];
      if (cash) setFromAccount(cash.id);
    }
    if (!toAccount) {
      const bank = accounts.find((a) => a.code === "1010") || accounts[1] || accounts[0];
      if (bank) setToAccount(bank.id);
    }
  }, [accounts, fromAccount, toAccount]);

  const fromBal = useMemo(
    () => accounts.find((a) => a.id === fromAccount)?.balance ?? 0,
    [accounts, fromAccount]
  );
  const toBal = useMemo(
    () => accounts.find((a) => a.id === toAccount)?.balance ?? 0,
    [accounts, toAccount]
  );
  const totalCash = useMemo(
    () => accounts.reduce((s, a) => s + Number(a.balance || 0), 0),
    [accounts]
  );

  const submit = useCallback(async () => {
    if (!fromAccount || !toAccount) {
      toast.error("Select source and destination accounts");
      return;
    }
    if (fromAccount === toAccount) {
      toast.error("Source and destination must be different");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > fromBal + 0.001) {
      toast.error(
        `Amount exceeds balance in source account (${currency} ${Number(fromBal).toLocaleString()})`
      );
      return;
    }
    setSaving(true);
    try {
      await api.post(
        "/finance/internal-transfers/",
        {
          from_account: fromAccount,
          to_account: toAccount,
          amount: amt,
          entry_date: entryDate,
          memo: memo || undefined,
          reference: reference || undefined,
        },
        { headers }
      );
      toast.success("Transfer recorded — balances updated");
      setAmount("");
      setMemo("");
      setReference("");
      void qc.invalidateQueries({ queryKey: ["internal-transfers"] });
      void qc.invalidateQueries({ queryKey: ["account-balances"] });
      // Clear finance dashboard cache so cash pots refresh
      try {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith("erp_finance_summary"))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch { /* */ }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.message || "Transfer failed");
    } finally {
      setSaving(false);
    }
  }, [
    fromAccount,
    toAccount,
    amount,
    entryDate,
    memo,
    reference,
    fromBal,
    currency,
    headers,
    qc,
  ]);

  const swap = () => {
    setFromAccount(toAccount);
    setToAccount(fromAccount);
  };

  return (
    <div className="space-y-5">
      <FinanceNavLinks />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-teal-700" />
            Evening reconciliation
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Move money between Cash, Bank and M-Pesa after the day&apos;s collections.
            Transfers stay inside the school — total cash position is unchanged; only
            which pot holds the money changes.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => dataQ.refetch()}
          disabled={dataQ.isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${dataQ.isFetching ? "animate-spin" : ""}`} />
          Refresh balances
        </Button>
      </div>

      {/* Current pots */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(accounts.length
          ? accounts
          : [
              { id: "x", code: "1000", name: "Cash on hand", balance: 0 },
              { id: "y", code: "1010", name: "Bank account", balance: 0 },
              { id: "z", code: "1020", name: "M-Pesa / mobile money", balance: 0 },
            ]
        ).map((a) => (
          <Card key={a.id || a.code} className="border-teal-100 bg-gradient-to-b from-teal-50/60 to-white">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-teal-900/70">
                {a.code ? `${a.code} · ` : ""}
                {a.name}
              </p>
              <p className="text-2xl font-bold tabular-nums text-teal-950 mt-1">
                {dataQ.isLoading
                  ? "…"
                  : `${currency} ${Number(a.balance || 0).toLocaleString()}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Combined position:{" "}
        <span className="font-semibold text-slate-800">
          {currency} {Number(totalCash).toLocaleString()}
        </span>{" "}
        (unchanged by internal transfers)
      </p>

      {/* Transfer form */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Record transfer</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Example: bank the day&apos;s cash — From <strong>Cash on hand</strong> → To{" "}
            <strong>Bank account</strong>. Or leave float in M-Pesa for paybill floats.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div className="space-y-1.5">
              <Label>From (source)</Label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name} ({currency} {Number(a.balance || 0).toLocaleString()})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Available: {currency} {Number(fromBal).toLocaleString()}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="mb-5 md:mb-6"
              onClick={swap}
              title="Swap accounts"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <div className="space-y-1.5">
              <Label>To (destination)</Label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={toAccount}
                onChange={(e) => setToAccount(e.target.value)}
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === fromAccount}>
                    {a.code} · {a.name} ({currency} {Number(a.balance || 0).toLocaleString()})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                After: {currency} {Number(toBal + (Number(amount) || 0)).toLocaleString()}{" "}
                (if full amount posts)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {fromBal > 0 && (
                <button
                  type="button"
                  className="text-[11px] text-teal-700 hover:underline"
                  onClick={() => setAmount(String(fromBal))}
                >
                  Move full balance ({currency} {Number(fromBal).toLocaleString()})
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input
                placeholder="Bank slip / M-Pesa code"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="e.g. Evening banking — cash collections for Term 3"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-1">
            <Button
              type="button"
              disabled={saving || !schoolId}
              onClick={submit}
              className="min-w-[140px] bg-teal-700 hover:bg-teal-800"
            >
              {saving ? "Posting…" : "Post transfer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {dataQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !transfers.length ? (
            <p className="text-sm text-muted-foreground">
              No internal transfers yet. Post your first evening banking above.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">From</th>
                    <th className="px-3 py-2 font-medium">To</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{t.entry_date || "—"}</td>
                      <td className="px-3 py-2">{t.from_account || "—"}</td>
                      <td className="px-3 py-2">{t.to_account || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {currency} {Number(t.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate">
                        {t.memo || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
