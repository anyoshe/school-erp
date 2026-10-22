// app/utils/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  getToken,
  saveToken,
  getRefreshToken,
  removeToken,
  getActiveSchoolId,
  getSchoolSupportSessionId,
  logout,
} from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await axios.post(
      `${API_BASE_URL.replace(/\/$/, "")}/accounts/token/refresh/`,
      { refresh },
      { headers: { "Content-Type": "application/json" } }
    );
    const access = res.data?.access as string | undefined;
    if (access) {
      saveToken(access);
      return access;
    }
    return null;
  } catch {
    return null;
  }
}

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

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };
      if (!original || error.response?.status !== 401 || original._retry) {
        return Promise.reject(error);
      }

      // Don't try to refresh the refresh call itself
      const url = original.url || "";
      if (url.includes("token/refresh") || url.includes("token/")) {
        return Promise.reject(error);
      }

      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (!newToken) {
        logout();
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      if (original.headers) {
        original.headers.Authorization = `Bearer ${newToken}`;
      }
      return api(original);
    }
  );
}

export const getCurrentUser = async (forceFresh: boolean = false) => {
  const params = forceFresh ? { t: Date.now() } : {};
  const res = await api.get("/accounts/me/", { params });
  return res.data;
};

export default api;
