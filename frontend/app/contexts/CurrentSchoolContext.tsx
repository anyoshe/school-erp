"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import api from "@/utils/api";
import {
  getActiveSchoolId,
  removeActiveSchool,
  removeSchoolSupportSessionId,
  setActiveSchool as persistActiveSchool,
  setSchoolSupportSessionId,
} from "@/utils/auth";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";

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
  currency_symbol?: string;
  currency_display?: string;
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
  isPlatformAdmin: boolean;
  refreshSchools: () => Promise<void>;
  enterSchoolSupport: (schoolId: string, reason: string) => Promise<void>;
  exitSchoolSupport: () => Promise<void>;
}

const CurrentSchoolContext = createContext<CurrentSchoolContextType | undefined>(undefined);

export function CurrentSchoolProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  // SSR-safe defaults (match server HTML). Hydrate from session cache in useLayoutEffect
  // so chrome paints with school data before the browser paints — no sidebar skeleton flash.
  const [schools, setSchools] = useState<School[]>([]);
  const [currentSchool, setCurrentSchoolState] = useState<School | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const initializedForUser = useRef<string | null>(null);
  const hydratedCache = useRef(false);

  useLayoutEffect(() => {
    if (hydratedCache.current) return;
    hydratedCache.current = true;
    const cachedSchool = readCachedActiveSchool<School>();
    const cachedList = readCachedSchoolsList<School[]>();
    if (cachedList?.length) setSchools(cachedList);
    if (cachedSchool) {
      setCurrentSchoolState(cachedSchool);
      setLoading(false);
    }
  }, []);

  const fetchAndSetSchools = useCallback(async () => {
    if (userLoading || !user) return;

    try {
      setError(null);
      setIsPlatformAdmin(Boolean(user.is_superuser));

      if (user.is_superuser) {
        setSchools([]);
        const contextResponse = await api.get("/schools/support-context/");
        const support = contextResponse.data;
        if (!support.active || !support.school || !support.id) {
          removeActiveSchool();
          removeSchoolSupportSessionId();
          setCurrentSchoolState(null);
          router.replace("/platform-admin");
          return;
        }

        persistActiveSchool(support.school.id);
        setSchoolSupportSessionId(support.id);
        const detailResponse = await api.get(`/schools/${support.school.id}/`);
        const schoolData = detailResponse.data as School;
        setCurrentSchoolState(schoolData);
        cacheActiveSchool(schoolData);
        return;
      }

      removeSchoolSupportSessionId();
      // my-schools already returns full SchoolSerializer (incl. modules)
      // — skip redundant detail request so dashboard mounts faster
      const schoolsResponse = await api.get("/schools/my-schools/");
      const fetchedSchools: School[] = schoolsResponse.data;
      setSchools(fetchedSchools);
      cacheSchoolsList(fetchedSchools);

      if (fetchedSchools.length === 0) {
        setCurrentSchoolState(null);
        removeActiveSchool();
        return;
      }

      const savedId = getActiveSchoolId();
      const selected = fetchedSchools.find((school) => school.id === savedId)
        || [...fetchedSchools].sort((a, b) =>
          new Date(b.updated_at || b.created_at || 0).getTime()
          - new Date(a.updated_at || a.created_at || 0).getTime()
        )[0];
      setCurrentSchoolState(selected);
      persistActiveSchool(selected.id);
      cacheActiveSchool(selected);
    } catch (err: any) {
      console.error("[Context] Failed to load schools:", err);
      setError("Could not load your schools. Please try again later.");
      toast.error("Failed to load school data", {
        description: err.response?.data?.detail || "Network or authentication issue",
      });
    } finally {
      setLoading(false);
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (
      !userLoading
      && user
      && initializedForUser.current !== user.id
    ) {
      initializedForUser.current = user.id;
      void fetchAndSetSchools();
    }
  }, [fetchAndSetSchools]);

  const setCurrentSchool = (school: School | null) => {
    setCurrentSchoolState(school);
    if (school) {
      persistActiveSchool(school.id);
      cacheActiveSchool(school);
    } else {
      removeActiveSchool();
    }
  };

  const enterSchoolSupport = async (schoolId: string, reason: string) => {
    const response = await api.post("/schools/start-support-context/", { school_id: schoolId, reason });
    persistActiveSchool(schoolId);
    setSchoolSupportSessionId(response.data.id);
    const schoolResponse = await api.get(`/schools/${schoolId}/`);
    const schoolData = schoolResponse.data as School;
    setCurrentSchoolState(schoolData);
    cacheActiveSchool(schoolData);
  };

  const exitSchoolSupport = async () => {
    await api.post("/schools/end-support-context/");
    removeActiveSchool();
    removeSchoolSupportSessionId();
    setCurrentSchoolState(null);
  };

  const refreshSchools = async () => {
    await fetchAndSetSchools();
  };

  return (
    <CurrentSchoolContext.Provider
      value={{
        currentSchool,
        setCurrentSchool,
        schools,
        loading,
        error,
        isPlatformAdmin,
        refreshSchools,
        enterSchoolSupport,
        exitSchoolSupport,
      }}
    >
      {children}
    </CurrentSchoolContext.Provider>
  );
}

export function useCurrentSchool() {
  const context = useContext(CurrentSchoolContext);
  if (!context) {
    throw new Error("useCurrentSchool must be used within CurrentSchoolProvider");
  }
  return context;
}
