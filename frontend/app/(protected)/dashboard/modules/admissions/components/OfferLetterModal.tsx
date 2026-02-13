"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Send, Download, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { Application } from "@/types/admission";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface FeeTerm {
  term: string;
  tuition: number;
  boarding: number;
  total: number;
}

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
  const [customMessage, setCustomMessage] = useState(
    "We are delighted to offer you admission to our institution for the upcoming academic year. Please review the details below and complete the enrollment process by the deadline."
  );

  // Editable fee structure (mock — replace with real API later)
  const [fees, setFees] = useState<FeeTerm[]>([
    { term: "Term 1", tuition: 45000, boarding: 30000, total: 75000 },
    { term: "Term 2", tuition: 45000, boarding: 30000, total: 75000 },
    { term: "Term 3", tuition: 45000, boarding: 30000, total: 75000 },
    { term: "Annual Total", tuition: 135000, boarding: 90000, total: 225000 },
  ]);

  const updateFee = (index: number, field: "tuition" | "boarding", value: string) => {
    const numValue = parseInt(value) || 0;
    setFees(prev => {
      const newFees = [...prev];
      newFees[index] = {
        ...newFees[index],
        [field]: numValue,
        total: field === "tuition" 
          ? numValue + newFees[index].boarding 
          : newFees[index].tuition + numValue,
      };

      if (index < 3) {
        const annualIndex = 3;
        const tuitionSum = newFees[0].tuition + newFees[1].tuition + newFees[2].tuition;
        const boardingSum = newFees[0].boarding + newFees[1].boarding + newFees[2].boarding;
        newFees[annualIndex] = {
          term: "Annual Total",
          tuition: tuitionSum,
          boarding: boardingSum,
          total: tuitionSum + boardingSum,
        };
      }

      return newFees;
    });
  };

  const generatePDF = async () => {
    const doc = new jsPDF();

    console.log("School data:", applicationData.school); // ← keep for debug

    // Extract school safely
    const sch = typeof applicationData.school === "object" ? applicationData.school : null;

    // Real fields from your School model
    const schoolName       = sch?.name || "School Name";
    const logoUrl          = sch?.logo || "https://via.placeholder.com/120x60?text=School+Logo";
    const schoolAddress    = sch?.address || "Physical Address Not Available";
    const schoolPostal     = sch?.postal_address || "Postal Address Not Available";
    const schoolPhone      = sch?.phone || sch?.alternative_phone || "Phone Not Available";
    const schoolEmail      = sch?.email || "Email Not Available";
    const schoolWebsite    = sch?.website ? `Website: ${sch.website}` : "";
    const schoolContact    = `${schoolPhone} | ${schoolEmail} ${schoolWebsite ? ` | ${schoolWebsite}` : ""}`.trim();

    // Add logo (centered top)
    try {
      const imgData = await loadImage(logoUrl);
      doc.addImage(imgData, "PNG", 85, 8, 40, 20); // centered
    } catch (err) {
      console.warn("Logo failed:", err);
      doc.setFontSize(14);
      doc.text("School Logo", 105, 25, { align: "center" });
    }

    // School name & full address block (top center, below logo)
    doc.setFontSize(18);
    doc.text(schoolName, 105, 40, { align: "center" });

    doc.setFontSize(10);
    doc.text(schoolAddress, 105, 48, { align: "center", maxWidth: 170 });
    if (schoolPostal !== "Postal Address Not Available") {
      doc.text(schoolPostal, 105, 54, { align: "center" });
    }
    doc.text(schoolContact, 105, schoolPostal !== "Postal Address Not Available" ? 60 : 54, { align: "center" });

    // Title
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text("ADMISSION OFFER LETTER", 105, 75, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 90);
    doc.text(`Ref: ${applicationId.slice(0, 8).toUpperCase()}`, 160, 90);

    // To section
    doc.setFontSize(14);
    doc.text("To:", 20, 110);
    doc.setFontSize(12);
    doc.text(applicationData.primary_guardian_name || "Guardian", 20, 120);
    doc.text(applicationData.primary_guardian_email || "", 20, 127);
    doc.text(applicationData.primary_guardian_phone || "", 20, 134);

    // Salutation
    doc.text(`Dear ${applicationData.primary_guardian_name || "Guardian"},`, 20, 155);

    // Body text
    const bodyText = `
We are pleased to inform you that ${applicationData.first_name} ${applicationData.last_name} has successfully completed the admission interview and has been offered admission to:

Class: ${applicationData.class_applied?.name || "N/A"}
School: ${schoolName}
Academic Year: 2026

${customMessage}

Please review the fee structure below and complete enrollment by the deadline.
    `.trim();

    const splitText = doc.splitTextToSize(bodyText, 170);
    doc.text(splitText, 20, 170);

    // Calculate exact end of body text
    const bodyEndY = 170 + (splitText.length * 5); // ~7pt per line

    // Fee Breakdown Table
    doc.setFontSize(14);
    doc.text("Fee Structure (KES)", 105, bodyEndY + 5, { align: "center" });

    autoTable(doc, {
      startY: bodyEndY + 15,
      head: [["Term", "Tuition", "Boarding", "Total"]],
      body: fees.map(item => [
        item.term,
        item.tuition.toLocaleString(),
        item.boarding.toLocaleString(),
        item.total.toLocaleString(),
      ]),
      theme: "striped",
      headStyles: { fillColor: [44, 62, 80] },
      styles: { fontSize: 10, cellPadding: 4 },
      margin: { left: 20, right: 20 },
    });

    // Acceptance Instructions (after table)
    const tableEndY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text("Acceptance Instructions:", 20, tableEndY);
    doc.setFontSize(11);
    doc.text(
      "• Accept within 14 days by signing and returning this letter\n" +
      "• Pay registration fee to secure place\n" +
      "• Submit required documents\n" +
      "• Contact Admissions Office for inquiries",
      20,
      tableEndY + 8,
      { maxWidth: 170 }
    );

    // Signature
    doc.text("Sincerely,", 20, tableEndY + 55);
    doc.text("Admissions Team", 20, tableEndY + 63);
    doc.text(schoolName, 20, tableEndY + 70);

    // Footer
    doc.setFontSize(10);
    doc.text("This is an official document. Please keep it safe.", 105, 280, { align: "center" });

    return doc;
  };

  const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleGenerateAndSend = async (method: "whatsapp" | "email" | "download") => {
    setLoading(true);

    try {
      const doc = await generatePDF();

      if (method === "download") {
        doc.save(`${applicationData.first_name}_${applicationData.last_name}_Admission_Offer.pdf`);
        toast.success("Admission letter downloaded!");
      } else if (method === "whatsapp" && applicationData.primary_guardian_phone) {
        const pdfBlob = doc.output("blob") as Blob;
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const msg = encodeURIComponent(
          `Dear Guardian,\n\nPlease find attached the Admission Offer Letter for ${applicationData.first_name} ${applicationData.last_name}.\n\nBest regards,\nAdmissions Team`
        );
        window.open(`https://wa.me/${applicationData.primary_guardian_phone}?text=${msg}`, "_blank");
        toast.success("WhatsApp opened — attach PDF manually");
      } else if (method === "email" && applicationData.primary_guardian_email) {
        const subject = encodeURIComponent("Admission Offer Letter");
        const body = encodeURIComponent(
          `Dear Guardian,\n\nAttached is the Admission Offer Letter for ${applicationData.first_name} ${applicationData.last_name}.\n\nBest regards,\nAdmissions Team`
        );
        window.open(`mailto:${applicationData.primary_guardian_email}?subject=${subject}&body=${body}`, "_blank");
        toast.success("Email composer opened — attach PDF manually");
      }

      onIssued?.();
    } catch (err) {
      toast.error("Failed to generate letter");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl">Issue Admission Offer Letter</DialogTitle>
          <DialogDescription>
            Customize the message and fees, then send or download the personalized offer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Student & School Summary */}
          <div className="bg-gray-50 p-5 rounded-xl border">
            <h4 className="font-medium mb-3">Offer Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Student:</span>
                <p className="font-medium">{applicationData.first_name} {applicationData.last_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Class Offered:</span>
                <p className="font-medium">{applicationData.class_applied?.name || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">Guardian:</span>
                <p className="font-medium">{applicationData.primary_guardian_name || "—"}</p>
              </div>
              <div>
                <span className="text-gray-500">Contact:</span>
                <p className="font-medium">
                  {applicationData.primary_guardian_phone || "—"} • {applicationData.primary_guardian_email || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Editable Fee Breakdown */}
          <div className="bg-gray-50 p-5 rounded-xl border">
            <h4 className="font-medium mb-3">Fee Structure (KES) - Editable</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Term</th>
                    <th className="text-right py-2">Tuition</th>
                    <th className="text-right py-2">Boarding</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 font-medium">{item.term}</td>
                      <td className="text-right py-2">
                        <Input
                          type="number"
                          value={item.tuition}
                          onChange={(e) => updateFee(index, "tuition", e.target.value)}
                          className="w-24 text-right"
                        />
                      </td>
                      <td className="text-right py-2">
                        <Input
                          type="number"
                          value={item.boarding}
                          onChange={(e) => updateFee(index, "boarding", e.target.value)}
                          className="w-24 text-right"
                        />
                      </td>
                      <td className="text-right py-2 font-medium">{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <Label>Personalized Message (optional)</Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="min-h-[120px]"
              placeholder="Additional welcome note or instructions..."
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => handleGenerateAndSend("whatsapp")}
              className="flex-1"
            >
              <Phone className="mr-2 h-4 w-4" />
              Send via WhatsApp
            </Button>

            <Button
              variant="outline"
              disabled={loading}
              onClick={() => handleGenerateAndSend("email")}
              className="flex-1"
            >
              <Mail className="mr-2 h-4 w-4" />
              Send via Email
            </Button>

            <Button
              disabled={loading}
              onClick={() => handleGenerateAndSend("download")}
              className="bg-indigo-600 hover:bg-indigo-700 flex-1"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

