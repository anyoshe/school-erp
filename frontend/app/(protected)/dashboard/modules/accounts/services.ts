import api from "@/utils/api";
import axios from "axios";
// ----------------------------
// Auth
// ----------------------------
export interface LoginResponse {
  access: string;
  refresh?: string;
}


export const loginUser = async (email: string, password: string) => {
  const response = await axios.post("http://localhost:8000/api/accounts/token/", {
    email,
    password,
  });
  return response.data; // { access: "...", refresh: "..." }
};


// ----------------------------
// Users
// ----------------------------
export interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_staff: boolean;
  created_at: string;
  updated_at: string;
}

export const getUsers = async (): Promise<User[]> => {
  const res = await api.get<User[]>("/accounts/users/");
  return res.data;
};

export interface CreateUserPayload {
  email: string;
  password: string;
  role: string;
  is_active?: boolean;
  is_staff?: boolean;
}

export const createUser = async (data: CreateUserPayload): Promise<User> => {
  const res = await api.post<User>("/accounts/users/", data);
  return res.data;
};
