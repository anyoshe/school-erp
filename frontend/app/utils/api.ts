// app/utils/api.ts
import axios from "axios";
import {
  getToken,
  getActiveSchoolId,
  getSchoolSupportSessionId,
} from "./auth";
import { isPaginatedList } from "./listResponse";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

if (typeof window !== "undefined") {
  api.interceptors.request.use((config) => {
    const token = getToken();
    const url = config.url || "";
    const isPlatformRequest =
      url.includes("/accounts/me/") ||
      url.includes("/schools/platform-directory/") ||
      url.includes("/schools/support-context/") ||
      url.includes("/schools/start-support-context/");
    const schoolId = isPlatformRequest ? null : getActiveSchoolId();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (schoolId && config.headers) {
      config.headers["X-School-ID"] = schoolId;
      const supportSessionId = getSchoolSupportSessionId();
      if (supportSessionId) {
        config.headers["X-School-Support-ID"] = supportSessionId;
      }
    }

    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }

    return config;
  });
}


// Unwrap DRF paginated list payloads so callers can safely use .map / .find / .filter.
// Detail/object responses are left unchanged. Code that already did `data.results || data`
// still works because arrays have no `.results` and fall back to the array itself.
if (typeof window !== "undefined") {
  api.interceptors.response.use(
    (response) => {
      if (isPaginatedList(response.data)) {
        response.data = response.data.results;
      }
      return response;
    },
    (error) => Promise.reject(error)
  );
}

export const getCurrentUser = async (forceFresh: boolean = false) => {
  const params = forceFresh ? { t: Date.now() } : {};
  const res = await api.get("/accounts/me/", { params });
  return res.data;
};

export default api;
