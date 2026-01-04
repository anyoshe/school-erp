"use client";

import { useEffect, useState } from "react";
import { guardianService } from "./guardianService";
import { StudentGuardianLink } from "./guardian.types";
import axios from "axios"; // Make sure axios is imported if not already available via api

export function useGuardians(studentId: string) {
  const [links, setLinks] = useState<StudentGuardianLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Optional: track real errors

  const fetchGuardians = async () => {
    if (!studentId) {
      setLinks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await guardianService.getByStudent(studentId);

      // Sort: primary guardians first
      data.sort((a, b) => Number(b.isPrimary || false) - Number(a.isPrimary || false));

      setLinks(data);
    } catch (err) {
      // Handle 404 specifically — it means "no guardians linked yet"
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        console.info("No guardians linked to this student yet (404 treated as empty)");
        setLinks([]); // Important: explicitly set empty array
      } else {
        // Real errors (network, 500, etc.)
        console.error("Failed to load guardians", err);
        setError("Failed to load guardians");
        setLinks([]); // Optional: reset or keep previous
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardians();
  }, [studentId]);

  return {
    links,
    loading,
    error,          // Expose if you want to show error messages
    refresh: fetchGuardians,
    setLinks,
  };
}