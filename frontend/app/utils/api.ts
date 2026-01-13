
// app/utils/api.ts
import axios from "axios";
import { getToken, getActiveSchoolId } from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach interceptors only in browser
if (typeof window !== "undefined") {
  api.interceptors.request.use((config) => {
    const token = getToken();
    const schoolId = getActiveSchoolId(); // store in localStorage or cookie

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (schoolId && config.headers) {
      config.headers["X-School-ID"] = schoolId;
    }

    // Handle FormData properly
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }

    return config;
  });
}

// ✅ Add helper method
export const getCurrentUser = async (forceFresh: boolean = false) => {
  const params = forceFresh ? { t: Date.now() } : {};
  const res = await api.get("/accounts/me/", { params });
  return res.data;
};
export default api;
