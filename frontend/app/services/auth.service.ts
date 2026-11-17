// app/services/auth.service.ts
import axios from "axios";

const API_URL = `${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "")}/`;

// Clean public axios (NO auth header ever)
const publicApi = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---------------------------
// LOGIN
// ---------------------------
export async function loginUser(email: string, password: string) {
  const payload = {
    email: (email || "").trim(),
    username: (email || "").trim(),
    password: password ?? "",
  };

  try {
    const res = await publicApi.post("accounts/token/", payload);
    return res.data;
  } catch (err: any) {
    // Normalize SimpleJWT / DRF error shapes for the login page
    if (err?.response?.status === 401) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Invalid email or password.";
      const e = new Error(typeof detail === "string" ? detail : "Invalid email or password.");
      (e as any).response = err.response;
      throw e;
    }
    throw err;
  }
}

// ---------------------------
// SIGNUP
// ---------------------------
export async function signupUser(payload: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) {
  const signupPayload = {
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: (payload.email || "").trim(),
    password: payload.password,
    role: "SCHOOL_ADMIN",
  };

  const res = await publicApi.post("accounts/users/", signupPayload);
  return res.data;
}
