"use client";

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

  useEffect(() => {
    const classId = applicationData?.class_applied?.id;
    if (!open || !classId) return;

    const loadFinanceData = async () => {
      setFeeLoading(true);
      try {
        // Fetch structures - includes term/period names from backend
        const structuresRes = await api.get("/finance/structures/", { 
          params: { grade_level: classId } 
        });
        setFeeStructures(structuresRes.data || []);
      } catch (err) {
        toast.error("Failed to load official fee structure");
      } finally {
        setFeeLoading(false);
      }
    };

    loadFinanceData();
  }, [open, applicationData.class_applied?.id]);

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

    const bodyText = `We are pleased to inform you that ${applicationData.first_name} ${applicationData.last_name} has been offered admission to ${applicationData.class_applied?.name || "N/A"} for the 2026 Academic Year.\n\n${customMessage}\n\nPlease find the detailed breakdown of fees per term attached on the next page.`;
    doc.text(doc.splitTextToSize(bodyText, 170), 20, 115);

    doc.text("Sincerely,", 20, 210);
    doc.text("Admissions Team", 20, 218);
    doc.text(schoolName, 20, 225);

    // --- PAGE 2: DETAILED FEE BREAKDOWN ---
    doc.addPage();
    doc.setFontSize(16).setTextColor(44, 62, 80).text("ANNUAL FEE SCHEDULE & BREAKDOWN", 105, 20, { align: "center" });
    doc.setFontSize(10).setTextColor(100).text(`Student: ${applicationData.first_name} ${applicationData.last_name} | Class: ${applicationData.class_applied?.name}`, 105, 28, { align: "center" });

    let currentY = 40;
    let annualTotal = 0;

    feeStructures.forEach((structure, index) => {
      // Using period_name (e.g. Term 1) to distinguish headers
      const periodLabel = structure.period_details?.name || structure.period_name || "Academic Period";
      doc.setFontSize(12).setTextColor(0).setFont("helvetica", "bold");
      doc.text(`${periodLabel}: ${structure.name}`.toUpperCase(), 20, currentY);
      doc.setFont("helvetica", "normal");

      const rows = (structure.structure_items || []).map((si: any) => [
        si.item_details?.name || "Fee Item",
        si.item_details?.category_name || "General",
        si.item_details?.is_optional ? "Optional" : "Mandatory",
        Number(si.amount).toLocaleString()
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Item Description", "Category", "Type", "Amount (KES)"]],
        body: rows,
        foot: [[{ content: `Total for ${periodLabel}`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: Number(structure.total_amount).toLocaleString(), styles: { fontStyle: 'bold' } }]],
        theme: "striped",
        headStyles: { fillColor: [44, 62, 80] },
      });

      annualTotal += Number(structure.total_amount);
      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 230 && index !== feeStructures.length - 1) { doc.addPage(); currentY = 20; }
    });

    // Totals & Banking (Restored your specific school model fields)
    doc.setFontSize(14).setFont("helvetica", "bold").text(`TOTAL ANNUAL: KES ${annualTotal.toLocaleString()}`, 190, currentY, { align: "right" });
    
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
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${hasGenerated ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              {hasGenerated ? <CheckCircle2 className="text-green-600 h-5 w-5" /> : <AlertCircle className="text-blue-600 h-5 w-5" />}
              <div className="text-sm">
                <p className="font-bold">{hasGenerated ? "Step 1 Complete" : "Step 1: Preview & Share"}</p>
                <p className="opacity-80">{hasGenerated ? "The student is ready to be marked as Offered." : "Download or share the letter via WhatsApp/Email first."}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-xl shadow-inner max-h-64 overflow-y-auto">
              <h4 className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">Structure Breakdown</h4>
              {feeLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                <div className="space-y-6">
                  {feeStructures.map(fs => (
                    <div key={fs.id} className="border-l-2 border-slate-700 pl-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase">{fs.period_details?.name || fs.period_name || "Period"}</span>
                        <span className="font-mono text-green-400">KES {Number(fs.total_amount).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-semibold mb-2">{fs.name}</p>
                      {fs.structure_items?.map((si: any) => (
                        <div key={si.id} className="flex justify-between text-[10px] text-slate-500">
                          <span>• {si.item_details?.name}</span>
                          <span>{Number(si.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ))}
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
             <Button variant="outline" onClick={() => handleAction("whatsapp")} disabled={loading}><Phone className="mr-2 h-4 w-4" /> WhatsApp</Button>
             <Button variant="outline" onClick={() => handleAction("email")} disabled={loading}><Mail className="mr-2 h-4 w-4" /> Email</Button>
             <Button variant="secondary" onClick={() => handleAction("download")} disabled={loading} title="Download Draft PDF">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
             </Button>
          </div>

          <Button 
            onClick={handleFinalize} 
            disabled={!hasGenerated || isUpdating}
            className={`px-8 ${hasGenerated ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300'}`}
          >
            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Finalize Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}