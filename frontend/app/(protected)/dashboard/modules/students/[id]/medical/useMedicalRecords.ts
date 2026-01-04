import { useEffect, useState } from "react";
import { MedicalRecord } from "./medical.types";
import { medicalService } from "./medicalService";

export function useMedicalRecords(studentId: string) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = async () => {
    setLoading(true);
    const data = await medicalService.getByStudent(studentId);

    // map snake_case to camelCase
    const mapped: MedicalRecord[] = data.map((r: any) => ({
      id: r.id,
      allergies: r.allergies,
      conditions: r.conditions,
      immunizationNotes: r.immunization_notes,
      lastVisit: r.last_visit,
    }));

    setRecords(mapped);
    setLoading(false);
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
