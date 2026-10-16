

// app/utils/auth.ts

// =====================
// TOKEN MANAGEMENT
// =====================
export const saveToken = (token: string) => {
  localStorage.setItem("token", token);
};

export const getToken = (): string | null => {
  return localStorage.getItem("token");
};

export const removeToken = () => {
  localStorage.removeItem("token");
};

// =====================
// SCHOOL (TENANT) MANAGEMENT
// =====================
const SCHOOL_KEY = "active_school_id";
const SCHOOL_SUPPORT_SESSION_KEY = "school_support_session_id";

export const setActiveSchool = (schoolId: string) => {
  localStorage.setItem(SCHOOL_KEY, schoolId);
};

export const getActiveSchoolId = (): string | null => {
  return localStorage.getItem(SCHOOL_KEY);
};

export const removeActiveSchool = () => {
  localStorage.removeItem(SCHOOL_KEY);
};

export const setSchoolSupportSessionId = (sessionId: string) => {
  localStorage.setItem(SCHOOL_SUPPORT_SESSION_KEY, sessionId);
};

export const getSchoolSupportSessionId = (): string | null => {
  return localStorage.getItem(SCHOOL_SUPPORT_SESSION_KEY);
};

export const removeSchoolSupportSessionId = () => {
  localStorage.removeItem(SCHOOL_SUPPORT_SESSION_KEY);
};

// =====================
// AUTH HELPERS
// =====================
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export const isSchoolSelected = (): boolean => {
  return !!getActiveSchoolId();
};

// Optional but VERY useful
const ACTIVE_SCHOOL_CACHE = "erp_active_school_cache";
const SCHOOLS_LIST_CACHE = "erp_schools_list_cache";
const SCHOOL_CACHE_META = "erp_active_school_cache_meta";

export const cacheActiveSchool = (school: unknown) => {
  try {
    sessionStorage.setItem(ACTIVE_SCHOOL_CACHE, JSON.stringify(school));
    sessionStorage.setItem(SCHOOL_CACHE_META, String(Date.now()));
  } catch { /* ignore */ }
};

export const readCachedActiveSchool = <T = unknown>(): T | null => {
  try {
    const raw = sessionStorage.getItem(ACTIVE_SCHOOL_CACHE);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheSchoolsList = (schools: unknown) => {
  try {
    sessionStorage.setItem(SCHOOLS_LIST_CACHE, JSON.stringify(schools));
  } catch { /* ignore */ }
};

export const readCachedSchoolsList = <T = unknown>(): T | null => {
  try {
    const raw = sessionStorage.getItem(SCHOOLS_LIST_CACHE);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const getSchoolCacheAgeMs = (): number => {
  try {
    const t = Number(sessionStorage.getItem(SCHOOL_CACHE_META) || 0);
    return t ? Date.now() - t : Infinity;
  } catch {
    return Infinity;
  }
};

export const logout = () => {
  removeToken();
  try {
    sessionStorage.removeItem("erp_current_user_cache");
    sessionStorage.removeItem(ACTIVE_SCHOOL_CACHE);
    sessionStorage.removeItem(SCHOOLS_LIST_CACHE);
    sessionStorage.removeItem(SCHOOL_CACHE_META);
  } catch {}
  removeActiveSchool();
  removeSchoolSupportSessionId();
};
