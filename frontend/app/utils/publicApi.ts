import { isPaginatedList } from "./listResponse";
// utils/publicApi.ts
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json", // default for JSON
  },
});

// Handle FormData correctly by removing Content-Type header
// (browser will set it with correct boundary)
publicApi.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});


publicApi.interceptors.response.use(
  (response) => {
    if (isPaginatedList(response.data)) {
      response.data = response.data.results;
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export default publicApi;