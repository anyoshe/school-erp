"use client";

import api from "../../../../../utils/api"; // Axios instance that auto-attaches JWT
const LOCAL_KEY = "students_cache";
const PENDING_CREATE = "pending_students";
const PENDING_UPDATE = "pending_updates";
const PENDING_DELETE = "pending_deletes";
// const API = "/api/students";
/* ---------------- helpers ---------------- */
const isBrowser = () => typeof window !== "undefined";

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

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

/* ---------------- Student Service ---------------- */
export const studentService = {
  /* ---------- GET ALL ---------- */
  async getAll() {
    try {
      const { data } = await api.get("/students/");
      const list = normalizeList(data);
      writeJSON(LOCAL_KEY, list);
      return list;
    } catch {
      console.warn("Offline mode: using local cache");
      const cached = readJSON(LOCAL_KEY);
      const pending = readJSON(PENDING_CREATE);
      return [...cached, ...pending];
    }
  },

   getById: async (id: string) => {
  const { data } = await api.get(`/students/${id}/`);
  return data;
},

  /* ---------- CREATE ---------- */
  async create(payload: any) {
    console.log("Creating student payload:", payload); 
    try {
      const { data } = await api.post("/students/", payload);
      const cached = readJSON(LOCAL_KEY);
      writeJSON(LOCAL_KEY, [...cached, data]);
      return data;
    } catch {
      // Offline fallback
      const offlineStudent = { ...payload, id: crypto.randomUUID(), _offline: true };
      const pending = readJSON(PENDING_CREATE);
      writeJSON(PENDING_CREATE, [...pending, offlineStudent]);
      return offlineStudent;
    }
  },

  /* ---------- UPDATE ---------- */
async update(id: string, payload: any) {
  try {
    const { data } = await api.patch(`/students/${id}/`, payload);
    const cached = readJSON(LOCAL_KEY);

    writeJSON(
      LOCAL_KEY,
      cached.map((s: any) => (s.id === id ? data : s))
    );

    return data;
  } catch (err: any) {
    console.error("PATCH FAILED:", err.response?.data);
    throw err;
  }
},


  /* ---------- DELETE ---------- */
 async remove(id: string) {
  if (!id) return;

  // 🔥 optimistic UI delete
  const cached = readJSON(LOCAL_KEY);
  writeJSON(
    LOCAL_KEY,
    cached.filter((s: any) => s.id !== id)
  );

  try {
    await api.delete(`/students/${id}/`);
  } catch {
    const pending = readJSON(PENDING_DELETE);
    writeJSON(PENDING_DELETE, [...pending, id]);
  }
},

  /* ---------- SYNC PENDING ---------- */
 async syncPending() {
  if (!isBrowser() || !navigator.onLine) return;

  // ----- CREATE -----
  for (const s of readJSON(PENDING_CREATE)) {
    const { _offline, id, ...payload } = s;
    await this.create(payload);
  }
  localStorage.removeItem(PENDING_CREATE);

  // ----- UPDATE -----
  for (const u of readJSON(PENDING_UPDATE)) {
    await this.update(u.id, u.payload);
  }
  localStorage.removeItem(PENDING_UPDATE);

  // ----- DELETE -----
  for (const id of readJSON(PENDING_DELETE)) {
    try {
      await api.delete(`/students/${id}/`);
    } catch {}
  }
  localStorage.removeItem(PENDING_DELETE);
}

};

/* ---------- AUTO SYNC WHEN ONLINE ---------- */
if (isBrowser()) {
  window.addEventListener("online", () => {
    studentService.syncPending();
  });
}
