import api from "@/utils/api";

export async function fetchSchoolPulse() {
  const { data } = await api.get("/schools/pulse/");
  return data;
}
