import type { AuthResponse, User } from "../types";
import { api } from "./client";

export interface RegisterInput {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export const login = (username: string, password: string) =>
  api.post<AuthResponse>("/auth/login/", { username, password });

export const register = (input: RegisterInput) => api.post<AuthResponse>("/auth/register/", input);

export const logout = () => api.post<void>("/auth/logout/");

export const getMe = () => api.get<User>("/auth/me/");
