

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
export const logout = () => {
  removeToken();
  try { sessionStorage.removeItem("erp_current_user_cache"); } catch {}
  removeActiveSchool();
  removeSchoolSupportSessionId();
};
