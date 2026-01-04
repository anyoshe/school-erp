// app/utils/api.ts
import axios from "axios";
import { getToken } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically add JWT token to all requests (browser only)
if (typeof window !== "undefined") {
  api.interceptors.request.use((config) => {
    const token = getToken(); // uses auth.ts getToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

export default api;
