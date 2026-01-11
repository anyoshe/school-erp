import { useEffect, useState } from "react";
import { MedicalRecord } from "../medical/medical.types";
import { medicalService } from "../medical/medicalService";

export function useMedicalRecords(studentId: string) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = async () => {
    if (!studentId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await medicalService.getByStudent(studentId);

      const mapped: MedicalRecord[] = (data as any[]).map((r) => ({
        id: r.id,

        // Core health info
        bloodGroup: r.blood_group || "",
        allergies: r.allergies || "",
        chronicConditions: r.chronic_conditions || "",
        specialNeeds: r.special_needs || "",
        medication: r.medication || "",
        medicationInstructions: r.medication_instructions || "",

        // Emergency
        emergencyNotes: r.emergency_notes || "",
        emergencyDoctor: r.emergency_doctor || "",
        preferredHospital: r.preferred_hospital || "",

        // Immunization
        immunizationStatus: r.immunization_status || "NOT_IMMUNIZED",
        immunizationNotes: r.immunization_notes || "",

        // Consent & Legal
        consentToTreat: r.consent_to_treat ?? false,
        medicalDisclosureAllowed: r.medical_disclosure_allowed ?? false,
        consentDate: r.consent_date || "",
        consentBy: typeof r.consent_by === "object" ? r.consent_by?.id : r.consent_by || "",

        // Audit
        recordedBy: typeof r.recorded_by === "object" ? r.recorded_by?.id : r.recorded_by || "",
        reviewedBy: typeof r.reviewed_by === "object" ? r.reviewed_by?.id : r.reviewed_by || "",
        reviewDate: r.review_date || "",

        // Documents
        documents:
          r.documents?.map((doc: any) => ({
            id: doc.id,
            name: doc.file.split("/").pop() || "document",
            url: doc.file,
          })) || [],

        // Timestamps
        createdAt: r.created_at || "",
        updatedAt: r.updated_at || "",
      }));

      setRecords(mapped);
    } catch (err) {
      console.error("Failed to fetch medical records:", err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [studentId]);

  return {
    records,
    loading,
    refresh: fetchRecords,
  };
}