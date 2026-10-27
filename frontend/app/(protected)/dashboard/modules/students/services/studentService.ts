"use client";

import api from "../../../../../utils/api";

const LOCAL_KEY = "students_cache";
const PENDING_CREATE = "pending_students";
const PENDING_UPDATE = "pending_updates";
const PENDING_DELETE = "pending_deletes";

const isBrowser = () => typeof window !== "undefined";

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export type StudentListPage = {
  results: any[];
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  pageSize: number;
};

function readJSON(key: string, fallback: any[] = []): any[] {
  if (!isBrowser()) return fallback;
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: any[]) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const studentService = {
  async getCached() {
    return readJSON(LOCAL_KEY, []);
  },

  /** Paginated list — default 50 per page for large schools */
  async getPage(opts?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }): Promise<StudentListPage> {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 50;
    const params: Record<string, string | number> = {
      page,
      page_size: pageSize,
    };
    if (opts?.search?.trim()) params.search = opts.search.trim();
    if (opts?.status && opts.status !== "all") params.status = opts.status;

    const { data } = await api.get("/students/", { params });

    // Non-paginated fallback
    if (Array.isArray(data)) {
      return {
        results: data,
        count: data.length,
        next: null,
        previous: null,
        page: 1,
        pageSize: data.length || pageSize,
      };
    }

    const results = normalizeList(data);
    if (page === 1 && !opts?.search) {
      writeJSON(LOCAL_KEY, results);
    }

    return {
      results,
      count: typeof data?.count === "number" ? data.count : results.length,
      next: data?.next ?? null,
      previous: data?.previous ?? null,
      page,
      pageSize,
    };
  },

  /** @deprecated prefer getPage — kept for callers that still want first page */
  async getAll() {
    try {
      const page = await this.getPage({ page: 1, pageSize: 50 });
      return page.results;
    } catch (error) {
      console.error("[studentService] API call failed:", error);
      const cached = readJSON(LOCAL_KEY);
      const pending = readJSON(PENDING_CREATE);
      return [...cached, ...pending];
    }
  },

  getById: async (id: string, opts?: { mode?: "edit" | "full" }) => {
    if (!id || id === "undefined" || id === "null") {
      throw new Error("Invalid student ID");
    }
    try {
      const mode = opts?.mode || "full";
      const { data } = await api.get(`/students/${id}/`, {
        params: mode === "edit" ? { mode: "edit" } : undefined,
      });
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  async create(payload: any) {
    try {
      const { data } = await api.post("/students/", payload);
      const cached = readJSON(LOCAL_KEY);
      writeJSON(LOCAL_KEY, [...cached, data]);
      return data;
    } catch {
      const offlineStudent = {
        ...payload,
        id: `temp-${Date.now()}`,
        _offline: true,
      };
      const pending = readJSON(PENDING_CREATE);
      writeJSON(PENDING_CREATE, [...pending, offlineStudent]);
      return offlineStudent;
    }
  },

  async update(id: string, payload: any) {
    try {
      const { data } = await api.patch(`/students/${id}/`, payload);
      const cached = readJSON(LOCAL_KEY).map((s: any) =>
        s.id === id ? { ...s, ...data } : s
      );
      writeJSON(LOCAL_KEY, cached);
      return data;
    } catch (err) {
      const pending = readJSON(PENDING_UPDATE);
      writeJSON(PENDING_UPDATE, [...pending, { id, payload }]);
      throw err;
    }
  },

  async remove(id: string) {
    try {
      await api.delete(`/students/${id}/`);
      writeJSON(
        LOCAL_KEY,
        readJSON(LOCAL_KEY).filter((s: any) => s.id !== id)
      );
    } catch {
      const pending = readJSON(PENDING_DELETE);
      writeJSON(PENDING_DELETE, [...pending, id]);
    }
  },
};
