import { create } from "zustand";
import { api } from "@/lib/api";

type LoginResponse = {
  token: string;
  expiresAt: number;
  user: string;
  role: string;
  scopes: string[];
};

type AuthState = {
  token: string;
  isAuthenticated: boolean;
  user: string;
  role: string;
  scopes: string[];

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => boolean;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: "",
  isAuthenticated: false,
  user: "",
  role: "",
  scopes: [],

  login: async (username, password) => {
    const data = await api.post<LoginResponse>("/auth/login", {
      username,
      password,
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("auth_user", data.user);
    localStorage.setItem("auth_role", data.role);
    localStorage.setItem("auth_scopes", JSON.stringify(data.scopes));
    set({
      token: data.token,
      isAuthenticated: true,
      user: data.user,
      role: data.role,
      scopes: data.scopes,
    });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_role");
    localStorage.removeItem("auth_scopes");
    set({ token: "", isAuthenticated: false, user: "", role: "", scopes: [] });
  },

  /** Read token from localStorage on app start. Returns true if a token exists. */
  hydrate: () => {
    if (typeof window === "undefined") return false;
    const token = localStorage.getItem("token") ?? "";
    if (token) {
      const user = localStorage.getItem("auth_user") ?? "";
      const role = localStorage.getItem("auth_role") ?? "";
      let scopes: string[] = [];
      try {
        scopes = JSON.parse(localStorage.getItem("auth_scopes") ?? "[]");
      } catch {
        scopes = [];
      }
      set({ token, isAuthenticated: true, user, role, scopes });
      return true;
    }
    return false;
  },
}));
