// app/services/auth.service.ts
import axios from "@/utils/api";

const API_URL = "/accounts/"; // matches your Django URLs

// ---------------------------
// LOGIN
// ---------------------------
export async function loginUser(email: string, password: string) {
  const res = await axios.post(`${API_URL}token/`, { email, password });
  return res.data; // { access, refresh }
}

// ---------------------------
// SIGNUP (DEV: default SCHOOL_ADMIN)
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
    email: payload.email,
    password: payload.password,
    role: "SCHOOL_ADMIN",
  };

  const res = await axios.post(`${API_URL}users/`, signupPayload);
  return res.data;
}