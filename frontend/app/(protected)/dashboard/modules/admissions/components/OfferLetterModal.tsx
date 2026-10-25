"use client";

import { classAppliedName, classAppliedId } from "@/types/admission";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText, Phone, Mail, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Application } from "@/types/admission";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "@/utils/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  applicationData: Application;
  onIssued?: () => void;
}

export default function OfferLetterModal({
  open,
  onOpenChange,
  applicationId,
  applicationData,
  onIssued,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [customMessage, setCustomMessage] = useState(
    "We are delighted to offer you admission to our institution for the upcoming academic year. Please review the details below and complete the enrollment process by the deadline."
  );

  const classId = classAppliedId(applicationData) || undefined;
  const className = classAppliedName(applicationData) || "the applied class";

  useEffect(() => {
    if (!open) return;

    if (!classId) {
      setFeeStructures([]);
      return;
    }

    const loadFinanceData = async () => {
      setFeeLoading(true);
      try {
        // Fee structures for THIS applicant's grade only (active)
        const structuresRes = await api.get("/finance/structures/", {
          params: { grade_level: classId, is_active: true, include_items: 1 },
        });
        const data = structuresRes.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];
        // Extra client guard: only structures for this grade
        const forGrade = list.filter(
          (s: any) =>
            !s.grade_level ||
            String(s.grade_level) === String(classId) ||
            String(s.grade_level?.id) === String(classId)
        );
        // Hydrate line items: lite list has totals only; detail has structure_items
        const detailed = await Promise.all(
          forGrade.map(async (s: any) => {
            if (Array.isArray(s.structure_items) && s.structure_items.length > 0) {
              return s;
            }
            try {
              const res = await api.get(`/finance/structures/${s.id}/`);
              return res.data || s;
            } catch (e) {
              console.warn("Failed to load structure detail", s.id, e);
              return s;
            }
          })
        );
        setFeeStructures(detailed.filter(Boolean));
        if (detailed.length === 0) {
          toast.message("No fee structure for this grade", {
            description:
              "Create an active fee structure in Finance for this class before issuing the offer letter.",
          });
        } else if (
          detailed.some(
            (s) => !Array.isArray(s?.structure_items) || s.structure_items.length === 0
          )
        ) {
          toast.message("Some fee structures have no saved line items", {
            description:
              "In Finance → Fee structures, edit each term and re-save the fee lines.",
          });
        }
      } catch (err) {
        setFeeStructures([]);
        toast.error("Failed to load fee structure for this grade");
      } finally {
        setFeeLoading(false);
      }
    };

    loadFinanceData();
  }, [open, classId]);

  const feesReady = !feeLoading && feeStructures.length > 0;
  const canGenerate = Boolean(classId) && feesReady;

  const lineName = (si: any) =>
    si.item_name || si.item_details?.name || si.name || "Fee item";
  const lineCategory = (si: any) =>
    si.category_name || si.item_details?.category_name || si.item_details?.category?.name || "Fees";
  const isOptionalLine = (si: any, structure: any) => {
    const itemId = String(si.item_details?.id ?? si.item ?? "");
    const opts = structure?.available_optional_items || [];
    if (opts.some((o: any) => String(o?.id ?? o) === itemId)) return true;
    if (si.is_optional != null) return !!si.is_optional;
    if (si.item_details?.is_optional != null) return !!si.item_details.is_optional;
    return false;
  };
  const splitLines = (structure: any) => {
    const items = Array.isArray(structure?.structure_items) ? structure.structure_items : [];
    const required: any[] = [];
    const optional: any[] = [];
    for (const si of items) {
      if (isOptionalLine(si, structure)) optional.push(si);
      else required.push(si);
    }
    return { required, optional, items };
  };
  const sumAmounts = (lines: any[]) =>
    lines.reduce((s, si) => s + Number(si.amount || 0), 0);

  /** Cross-tab schedule: Description | Term 1 | Term 2 | Term 3 (ERP style) */
  const buildAnnualFeeMatrix = (structures: any[]) => {
    const sorted = [...structures].sort((a, b) => {
      const pa = String(a.period_name || "");
      const pb = String(b.period_name || "");
      const na = pa.match(/(\d+)/)?.[1] || "9";
      const nb = pb.match(/(\d+)/)?.[1] || "9";
      return Number(na) - Number(nb) || pa.localeCompare(pb);
    });

    const periodKeys = sorted.map((s, i) => {
      const label = s.period_name || s.period_details?.name || `Term ${i + 1}`;
      return { id: String(s.id), label, structure: s };
    });

    type Cell = { amount: number; optional: boolean };
    // key = fee description name
    const rowMap = new Map<string, { optional: boolean; cells: Record<string, Cell> }>();

    for (const { id, structure } of periodKeys) {
      const { required, optional, items } = splitLines(structure);
      const all = items.length ? items : [];
      if (!all.length && Number(structure.total_amount || 0) > 0) {
        // fallback single row when lines missing
        const key = "School fees";
        if (!rowMap.has(key)) rowMap.set(key, { optional: false, cells: {} });
        rowMap.get(key)!.cells[id] = {
          amount: Number(structure.total_amount || 0),
          optional: false,
        };
        continue;
      }
      for (const si of required) {
        const key = lineName(si);
        if (!rowMap.has(key)) rowMap.set(key, { optional: false, cells: {} });
        const row = rowMap.get(key)!;
        row.optional = false;
        row.cells[id] = {
          amount: (row.cells[id]?.amount || 0) + Number(si.amount || 0),
          optional: false,
        };
      }
      for (const si of optional) {
        const key = `${lineName(si)} (Optional)`;
        if (!rowMap.has(key)) rowMap.set(key, { optional: true, cells: {} });
        const row = rowMap.get(key)!;
        row.optional = true;
        row.cells[id] = {
          amount: (row.cells[id]?.amount || 0) + Number(si.amount || 0),
          optional: true,
        };
      }
    }

    const fmt = (n: number) =>
      n > 0 ? Number(n).toLocaleString() : "—";

    const head = ["Description", ...periodKeys.map((p) => p.label)];
    const body: string[][] = [];
    const requiredRows: string[][] = [];
    const optionalRows: string[][] = [];

    for (const [desc, row] of rowMap.entries()) {
      const cells = periodKeys.map((p) => fmt(row.cells[p.id]?.amount || 0));
      const line = [desc, ...cells];
      if (row.optional) optionalRows.push(line);
      else requiredRows.push(line);
    }

    // Totals per term (required only for "must pay"; grand includes optional listed)
    const termRequiredTotals = periodKeys.map((p) => {
      let t = 0;
      for (const row of rowMap.values()) {
        if (!row.optional) t += row.cells[p.id]?.amount || 0;
      }
      // fallback to structure total if no lines
      if (t === 0) t = Number(p.structure.total_amount || 0);
      return t;
    });
    const termAllTotals = periodKeys.map((p, i) => {
      let t = 0;
      for (const row of rowMap.values()) {
        t += row.cells[p.id]?.amount || 0;
      }
      if (t === 0) t = termRequiredTotals[i];
      return t;
    });

    body.push(...requiredRows);
    if (optionalRows.length) {
      body.push(["— Optional fees —", ...periodKeys.map(() => "")]);
      body.push(...optionalRows);
    }
    body.push([
      "TOTAL PER TERM",
      ...termAllTotals.map((n) => Number(n).toLocaleString()),
    ]);

    const annualRequired = termRequiredTotals.reduce((a, b) => a + b, 0);
    const annualAll = termAllTotals.reduce((a, b) => a + b, 0);

    return {
      head,
      body,
      periodKeys,
      termRequiredTotals,
      termAllTotals,
      annualRequired,
      annualAll,
      requiredRows,
      optionalRows,
    };
  };


  const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    const sch: any = typeof applicationData.school === "object" ? applicationData.school : {};
    const schoolName = sch?.name || "School Name";
    const logoUrl = sch?.logo || "https://via.placeholder.com/120x60?text=Logo";
    const schoolContact = `${sch?.address || ""}, ${sch?.city || ""} | ${sch?.phone || ""} | ${sch?.email || ""}`.trim();

    // --- PAGE 1: ADMISSION LETTER ---
    try {
      const imgData = await loadImage(logoUrl);
      doc.addImage(imgData, "PNG", 85, 10, 40, 20);
    } catch (err) {
      doc.setFontSize(14).text(schoolName, 105, 20, { align: "center" });
    }

    doc.setFontSize(18).setFont("helvetica", "bold").text(schoolName, 105, 40, { align: "center" });
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(100).text(schoolContact, 105, 46, { align: "center" });

    doc.setFontSize(22).setTextColor(44, 62, 80).text("ADMISSION OFFER LETTER", 105, 70, { align: "center" });

    doc.setFontSize(12).setTextColor(0).text(`Date: ${new Date().toLocaleDateString()}`, 20, 85);
    doc.text(`Ref: ${applicationId.slice(0, 8).toUpperCase()}`, 160, 85);

    doc.text(`Dear ${applicationData.primary_guardian_name || "Guardian"},`, 20, 105);

    const bodyText = `We are pleased to inform you that ${applicationData.first_name} ${applicationData.last_name} has been offered admission to ${classAppliedName(applicationData) || "N/A"} for the 2026 Academic Year.\n\n${customMessage}\n\nPlease find the detailed breakdown of fees per term attached on the next page.`;
    doc.text(doc.splitTextToSize(bodyText, 170), 20, 115);

    doc.text("Sincerely,", 20, 210);
    doc.text("Admissions Team", 20, 218);
    doc.text(schoolName, 20, 225);

    // --- PAGE 2: ANNUAL FEE MATRIX (Description × Term 1 / 2 / 3) ---
    doc.addPage();
    doc.setFontSize(16).setTextColor(44, 62, 80).text("ANNUAL FEE SCHEDULE", 105, 20, { align: "center" });
    doc.setFontSize(10).setTextColor(100).text(
      `Student: ${applicationData.first_name} ${applicationData.last_name} | Class: ${classAppliedName(applicationData) || "N/A"}`,
      105,
      28,
      { align: "center" }
    );

    const matrix = buildAnnualFeeMatrix(feeStructures);
    let currentY = 36;
    let annualTotal = matrix.annualAll;

    doc.setFontSize(9).setTextColor(80).setFont("helvetica", "normal");
    doc.text(
      `Fee schedule for ${classAppliedName(applicationData) || "the offered class"} (amounts in KES). Optional items are marked.`,
      20,
      currentY
    );
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      head: [matrix.head],
      body: matrix.body,
      theme: "grid",
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        halign: "center",
      },
      bodyStyles: { fontSize: 9, textColor: 30 },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: "bold", halign: "left" },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
      didParseCell: (data: any) => {
        const raw = String(data.cell.raw || "");
        if (raw.startsWith("TOTAL PER TERM") || raw.startsWith("— Optional")) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 253, 250];
        }
        if (raw.includes("(Optional)")) {
          data.cell.styles.textColor = [180, 100, 20];
        }
      },
      margin: { left: 20, right: 20 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 12;

    // Totals & Banking
    doc.setFontSize(12).setFont("helvetica", "bold").setTextColor(15, 118, 110);
    doc.text(`TOTAL ANNUAL (all terms): KES ${annualTotal.toLocaleString()}`, 190, currentY, {
      align: "right",
    });
    if (matrix.annualRequired > 0 && matrix.annualRequired !== matrix.annualAll) {
      currentY += 6;
      doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(80);
      doc.text(
        `Required only: KES ${matrix.annualRequired.toLocaleString()}  ·  Optional listed: KES ${(matrix.annualAll - matrix.annualRequired).toLocaleString()}`,
        190,
        currentY,
        { align: "right" }
      );
    }
    
    currentY += 20;
    doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(44, 62, 80).text("PAYMENT INSTRUCTIONS", 20, currentY);
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(0);
    let bankY = currentY + 7;
    
    if (sch?.bank_name) {
      doc.text(`Bank: ${sch.bank_name} (${sch.branch_name || "Main"})`, 20, bankY); bankY += 5;
      doc.text(`Acc Name: ${sch.bank_account_name || schoolName}`, 20, bankY); bankY += 5;
      doc.text(`Acc No: ${sch.bank_account_number || "N/A"}`, 20, bankY); bankY += 5;
    }
    if (sch?.paybill_number) {
      doc.text(`M-Pesa Paybill: ${sch.paybill_number}`, 20, bankY); bankY += 5;
    }
    doc.setFont("helvetica", "bold").text(`Payment Reference: ${applicationData.first_name.toUpperCase()}${applicationId.slice(0, 4)}`, 20, bankY);

  
    currentY = bankY + 10;
    if (currentY > 235) { doc.addPage(); currentY = 20; }

    doc.setFillColor(249, 250, 251); // Light background for signature block
    doc.rect(20, currentY, 170, 45, "F"); 
    doc.setDrawColor(209, 213, 219);
    doc.rect(20, currentY, 170, 45, "S");

    doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(0);
    doc.text("Parent/Guardian Declaration:", 25, currentY + 10);
    
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(50);
    const declaration = `I, the undersigned, hereby accept the offer of admission for my child. I agree to abide by the school rules and regulations and undertake to pay the school fees as outlined in this schedule.`;
    const splitDeclaration = doc.splitTextToSize(declaration, 160);
    doc.text(splitDeclaration, 25, currentY + 18);

    doc.line(25, currentY + 38, 90, currentY + 38); 
    doc.text("Signature", 25, currentY + 42);

    doc.line(120, currentY + 38, 185, currentY + 38); 
    doc.text("Date", 120, currentY + 42);

    doc.setFontSize(8).setTextColor(150);
    doc.text("Please return a signed copy within 14 days to secure placement.", 105, 285, { align: "center" });

    return doc;
  };

  const handleAction = async (method: "whatsapp" | "email" | "download") => {
    if (!classId) {
      toast.error("This application has no class/grade. Assign a class before issuing an offer.");
      return;
    }
    if (feeLoading) {
      toast.error("Fee structure is still loading. Please wait.");
      return;
    }
    if (!feeStructures.length) {
      toast.error("No fee structure for " + className, {
        description: "Set up fees under Finance → Fee structures for this grade, then try again.",
      });
      return;
    }

    setLoading(true);
    try {
      const doc = await generatePDF();
      const pdfBlob = doc.output("blob");
      const pdfName = `${applicationData.first_name}_Admission_Offer.pdf`;

      if (method === "download") {
        doc.save(pdfName);
      } else {
        const msg = encodeURIComponent(`Hello, please find the admission letter for ${applicationData.first_name}.`);
        const url = method === "whatsapp" 
          ? `https://wa.me/${applicationData.primary_guardian_phone}?text=${msg}`
          : `mailto:${applicationData.primary_guardian_email}?subject=Admission Offer&body=${msg}`;
        window.open(url, "_blank");
      }
      setHasGenerated(true);
      toast.success("Letter ready for final issuance.");
    } catch (err) {
      toast.error("Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setIsUpdating(true);
    try {
      await api.patch(`/admissions/applications/${applicationId}/`, { status: "OFFERED" });
      onIssued?.();
      toast.success("Application officially marked as Offered.");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl p-0 border-none shadow-2xl">
        <div className="p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Issue Admission Offer Letter</DialogTitle>
            <DialogDescription>Review fee periods and send the official letter.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            {/* Logic Step Tracker */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${hasGenerated ? 'bg-secondary-50 border-secondary-200' : 'bg-primary-50 border-primary-200'}`}>
              {hasGenerated ? <CheckCircle2 className="text-secondary-600 h-5 w-5" /> : <AlertCircle className="text-primary-700 h-5 w-5" />}
              <div className="text-sm">
                <p className="font-bold">{hasGenerated ? "Step 1 Complete" : "Step 1: Preview & Share"}</p>
                <p className="opacity-80">{hasGenerated ? "The student is ready to be marked as Offered." : "Download or share the letter via WhatsApp/Email first."}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-xl shadow-inner max-h-64 overflow-y-auto">
              <h4 className="text-primary-400 text-xs font-bold uppercase tracking-widest mb-4">Structure Breakdown</h4>
              {!classId ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  No class/grade on this application. Set <strong>class applied</strong> first so the correct fee structure can load.
                </p>
              ) : feeLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="animate-spin h-5 w-5" />
                  Loading fee structure for {className}…
                </div>
              ) : feeStructures.length === 0 ? (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
                  <p className="font-semibold">No active fee structure for {className}</p>
                  <p className="text-amber-700/90">
                    Go to <strong>Finance → Fee structures</strong>, create (or activate) a structure for this grade, then reopen this offer letter.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-xs text-slate-400 mb-3">
                    Annual schedule for <span className="font-semibold text-slate-200">{className}</span> — Description × Term
                  </p>
                  {(() => {
                    const matrix = buildAnnualFeeMatrix(feeStructures);
                    return (
                      <div className="overflow-x-auto rounded-lg border border-slate-700">
                        <table className="w-full text-[11px] text-left">
                          <thead>
                            <tr className="bg-slate-800 text-slate-200">
                              {matrix.head.map((h) => (
                                <th key={h} className="px-2 py-2 font-semibold whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {matrix.body.map((row, ri) => (
                              <tr
                                key={ri}
                                className={
                                  String(row[0]).startsWith("TOTAL")
                                    ? "bg-slate-800/80 font-semibold text-teal-200"
                                    : String(row[0]).startsWith("— Optional")
                                      ? "bg-slate-800/40 text-amber-200/90"
                                      : "border-t border-slate-700/80 text-slate-300"
                                }
                              >
                                {row.map((cell, ci) => (
                                  <td
                                    key={ci}
                                    className={`px-2 py-1.5 ${ci === 0 ? "text-left" : "text-right font-mono"}`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-[10px] text-slate-500 px-2 py-2">
                          Annual total: KES {matrix.annualAll.toLocaleString()}
                          {matrix.annualRequired !== matrix.annualAll
                            ? ` (required ${matrix.annualRequired.toLocaleString()})`
                            : ""}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Custom Letter Message</Label>
              <Textarea 
                value={customMessage} 
                onChange={(e) => { setCustomMessage(e.target.value); setHasGenerated(false); }} 
                className="min-h-[80px] text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t sticky bottom-0">
          <div className="flex gap-2">
             <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
             <Button variant="outline" onClick={() => handleAction("whatsapp")} disabled={loading || !canGenerate}><Phone className="mr-2 h-4 w-4" /> WhatsApp</Button>
             <Button variant="outline" onClick={() => handleAction("email")} disabled={loading || !canGenerate}><Mail className="mr-2 h-4 w-4" /> Email</Button>
             <Button variant="secondary" onClick={() => handleAction("download")} disabled={loading || !canGenerate} title="Download Draft PDF">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
             </Button>
          </div>

          <Button 
            onClick={handleFinalize} 
            disabled={!hasGenerated || isUpdating}
            className={`px-8 ${hasGenerated ? 'bg-primary hover:bg-primary-700' : 'bg-slate-300'}`}
          >
            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Finalize Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
