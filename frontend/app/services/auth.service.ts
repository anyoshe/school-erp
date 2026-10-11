// // app/services/auth.service.ts
// import axios from "@/utils/api";

// const API_URL = "/accounts/"; // matches your Django URLs

// // ---------------------------
// // LOGIN
// // ---------------------------
// export async function loginUser(email: string, password: string) {
//   const res = await axios.post(`${API_URL}token/`, { email, password });
//   return res.data; // { access, refresh }
// }

// // ---------------------------
// // SIGNUP (DEV: default SCHOOL_ADMIN)
// // ---------------------------
// export async function signupUser(payload: {
//   first_name: string;
//   last_name: string;
//   email: string;
//   password: string;
// }) {
//   const signupPayload = {
//     first_name: payload.first_name,
//     last_name: payload.last_name,
//     email: payload.email,
//     password: payload.password,
//     role: "SCHOOL_ADMIN",
//   };

//   const res = await axios.post(`${API_URL}users/`, signupPayload);
//   return res.data;
// }

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

// If you want, you can keep your private one for protected calls later
// const privateApi = axios.create({ baseURL: API_URL });
// ... add interceptor to privateApi only

// ---------------------------
// LOGIN
// ---------------------------
export async function loginUser(email: string, password: string) {
  const payload = {
    email,
    username: email,
    password,
  };

  const res = await publicApi.post("accounts/token/", payload);
  return res.data;
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
    email: payload.email,
    password: payload.password,
    role: "SCHOOL_ADMIN",        // you can change this later if needed
  };

  const res = await publicApi.post("accounts/users/", signupPayload);
  return res.data;
}