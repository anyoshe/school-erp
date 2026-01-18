// app/contexts/CurrentSchoolContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "@/utils/api";
import { toast } from "sonner";

// ────────────────────────────────────────────────────────────────
// Types (expanded to include all current fields from your backend)
// ────────────────────────────────────────────────────────────────
export interface Module {
  id: number;
  name: string;
  code: string;
}

export interface School {
  id: string;
  owner: string;
  name: string;
  short_name?: string;
  email?: string;
  phone?: string;
  alternative_phone?: string;
  emergency_phone?: string;
  address?: string;
  postal_address?: string;
  city?: string;
  country?: string;
  website?: string;
  currency?: string;
  academic_year_start_month?: number;
  academic_year_end_month?: number;
  term_system?: string;
  number_of_terms?: number;
  grading_system?: string;
  passing_mark?: number;
  official_registration_number?: string;
  registration_authority?: string;
  registration_date?: string;
  admission_fee?: number;
  logo?: string | null;
  module_ids?: number[];
  modules: Module[];
  setup_complete?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CurrentSchoolContextType {
  currentSchool: School | null;
  setCurrentSchool: (school: School | null) => void;
  schools: School[];
  loading: boolean;
  error: string | null;
  refreshSchools: () => Promise<void>;
}

const CurrentSchoolContext = createContext<CurrentSchoolContextType | undefined>(undefined);

export function CurrentSchoolProvider({ children }: { children: ReactNode }) {
  const [schools, setSchools] = useState<School[]>([]);
  const [currentSchool, setCurrentSchoolState] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────────
  // Core fetch logic (full details every time)
  // ────────────────────────────────────────────────────────────────
  const fetchAndSetSchools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get list of all accessible schools
      const schoolsRes = await api.get("/schools/my-schools/");
      const fetchedSchools: School[] = schoolsRes.data;
      setSchools(fetchedSchools);

      if (fetchedSchools.length === 0) {
        setCurrentSchoolState(null);
        localStorage.removeItem("currentSchoolId");
        return;
      }

      // 2. Decide which one to select as current
      const savedId = localStorage.getItem("currentSchoolId");
      let selected = savedId ? fetchedSchools.find((s) => s.id === savedId) : null;

      // Fallback: newest or first school
      if (!selected) {
        selected = fetchedSchools.sort((a, b) => 
          new Date(b.updated_at || b.created_at || 0).getTime() - 
          new Date(a.updated_at || a.created_at || 0).getTime()
        )[0];
      }

      if (selected) {
        // 3. Always fetch FULL details (important for new fields!)
        const detailRes = await api.get(`/schools/${selected.id}/`);
        const fullSchool = detailRes.data as School;

        setCurrentSchoolState(fullSchool);
        localStorage.setItem("currentSchoolId", selected.id);
        console.log("[Context] Current school loaded:", fullSchool.id, fullSchool.name);
      }
    } catch (err: any) {
      console.error("[Context] Failed to load schools:", err);
      setError("Could not load your schools. Please try again later.");
      toast.error("Failed to load school data", {
        description: err.response?.data?.detail || "Network or authentication issue",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAndSetSchools();
  }, [fetchAndSetSchools]);

  // Public refresh method (called from pages after updates)
  const refreshSchools = async () => {
    console.log("[Context] Manual refresh triggered");
    await fetchAndSetSchools();
  };

  // Custom setter with persistence
  const setCurrentSchool = (school: School | null) => {
    setCurrentSchoolState(school);
    if (school) {
      localStorage.setItem("currentSchoolId", school.id);
    } else {
      localStorage.removeItem("currentSchoolId");
    }
  };

  return (
    <CurrentSchoolContext.Provider
      value={{
        currentSchool,
        setCurrentSchool,
        schools,
        loading,
        error,
        refreshSchools,
      }}
    >
      {children}
    </CurrentSchoolContext.Provider>
  );
}

// Hook
export function useCurrentSchool() {
  const context = useContext(CurrentSchoolContext);
  if (!context) {
    throw new Error("useCurrentSchool must be used within CurrentSchoolProvider");
  }
  return context;
}