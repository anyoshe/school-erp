"use client";

import { useEffect, useState } from "react";
import { Student } from "../types/student";
import { studentService } from "../services/studentService";

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = async () => {
    setLoading(true);

    try {
      const data = await studentService.getAll();

      // 🔥 normalize response
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.results)
          ? (data as any).results
          : [];

      // const mapped: Student[] = data.map((s: any) => ({
       const mapped: Student[] = list.map((s: any) => ({
        id: s.id ?? s._offline_id ?? s.tempId ?? s.id, // defensive
        admissionNo: s.admission_number ?? s.admissionNo,
        firstName: s.first_name ?? s.firstName,
        lastName: s.last_name ?? s.lastName,
        gender: s.gender === "Female" ? "Female" : "Male",
        dateOfBirth: s.date_of_birth ?? null,
        classId: s.current_class ?? s.classId ?? "",
        status: mapStatus(s.status ?? "ACTIVE"),
        createdAt: s.created_at ?? new Date().toISOString(),
        _offline: s._offline ?? false,
      }));


      setStudents(mapped);
    } catch (err) {
      console.error("Failed to load students", err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();

    const handleOnline = async () => {
      await studentService.syncPending();
      fetchStudents();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return {
    students,
    loading,
    refresh: fetchStudents,
  };
}

function mapStatus(status?: string): Student["status"] {
  switch (status) {
    case "GRADUATED":
    case "Graduated":
      return "GRADUATED";
    case "TRANSFERRED":
    case "Transferred":
      return "TRANSFERRED";
    default:
      return "ACTIVE";
  }
}
