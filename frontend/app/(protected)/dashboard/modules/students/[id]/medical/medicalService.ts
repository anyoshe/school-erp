import api from "@/utils/api";
import { MedicalRecord } from "./medical.types";

/* ---------- Payload type matching Django MedicalRecord ---------- */
export interface MedicalPayload {
  blood_group?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
  special_needs?: string | null;
  medication?: string | null;
  medication_instructions?: string | null;
  emergency_notes?: string | null;
  emergency_doctor?: string | null;
  preferred_hospital?: string | null;
  immunization_status?: "UP_TO_DATE" | "PARTIAL" | "NOT_IMMUNIZED";
  immunization_notes?: string | null;
  consent_to_treat?: boolean;
  medical_disclosure_allowed?: boolean;
  consent_date?: string | null;
  consent_by?: string | null;
  // Remove immunizationCard and status_badges
}

export const medicalService = {
  /* ---------- GET MEDICAL RECORDS BY STUDENT ---------- */
  async getByStudent(studentId: string): Promise<MedicalRecord[]> {
    if (!studentId) return [];

    const { data } = await api.get(`/students/medical-records/?student=${studentId}`);

    // handle both array and paginated { results: [...] }
    return Array.isArray(data) ? data : data.results ?? [];
  },

  /* ---------- CREATE MEDICAL RECORD ---------- */
   async createRecord(studentId: string, payload: MedicalPayload, documents: File[] = []) {
    const formData = new FormData();
    formData.append("student", studentId);

    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      formData.append(key, typeof value === "boolean" ? String(value) : value);
    });

    documents.forEach(file => formData.append("documents", file));

    const { data } = await api.post("/students/medical-records/", formData);
    return data;
  },

  /* ---------- UPDATE MEDICAL RECORD ---------- */
  async updateRecord(id: string, payload: MedicalPayload, documents: File[] = []) {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      formData.append(key, typeof value === "boolean" ? String(value) : value);
    });

    documents.forEach(file => formData.append("documents", file));

    // USE PATCH, NOT PUT
    const { data } = await api.patch(`/students/medical-records/${id}/`, formData);
    return data;
  },
  /* ---------- DELETE MEDICAL RECORD ---------- */
  async deleteRecord(id: string): Promise<void> {
    await api.delete(`/students/medical-records/${id}/`);
  },

  /* ---------- DOWNLOAD MEDICAL RECORD DOCUMENT ---------- */
  async downloadDocument(url: string, filename?: string) {
    const response = await api.get(url, { responseType: "blob" });
    const blob = new Blob([response.data]);
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = filename || url.split("/").pop() || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
