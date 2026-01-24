// utils/publicApi.ts
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "multipart/form-data", // default for FormData
  },
});

// No interceptors — no auth token, no X-School-ID
// But still handle FormData correctly
publicApi.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    // Let browser set boundary automatically
    delete config.headers["Content-Type"];
  }
  return config;
});

export default publicApi;