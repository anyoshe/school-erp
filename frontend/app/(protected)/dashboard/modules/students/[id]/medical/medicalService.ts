const API = "/api";

export const medicalService = {
  getByStudent: async (studentId: string) => {
    const res = await fetch(`${API}/medical-records/?student=${studentId}`);
    return res.json();
  },

  createRecord: async (studentId: string, payload: any) => {
    return fetch(`${API}/medical-records/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student: studentId, ...payload }),
    });
  },

  updateRecord: async (id: string, payload: any) => {
    return fetch(`${API}/medical-records/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  deleteRecord: async (id: string) => {
    return fetch(`${API}/medical-records/${id}/`, { method: "DELETE" });
  },
};
