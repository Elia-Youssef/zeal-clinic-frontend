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
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("auth_user", data.user);
    sessionStorage.setItem("auth_role", data.role);
    sessionStorage.setItem("auth_scopes", JSON.stringify(data.scopes));
    set({
      token: data.token,
      isAuthenticated: true,
      user: data.user,
      role: data.role,
      scopes: data.scopes,
    });
  },

  logout: () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("auth_user");
    sessionStorage.removeItem("auth_role");
    sessionStorage.removeItem("auth_scopes");
    set({ token: "", isAuthenticated: false, user: "", role: "", scopes: [] });
  },

  /** Read token from sessionStorage on app start. Returns true if a token exists. */
  hydrate: () => {
    if (typeof window === "undefined") return false;
    const token = sessionStorage.getItem("token") ?? "";
    if (token) {
      const user = sessionStorage.getItem("auth_user") ?? "";
      const role = sessionStorage.getItem("auth_role") ?? "";
      let scopes: string[] = [];
      try {
        scopes = JSON.parse(sessionStorage.getItem("auth_scopes") ?? "[]");
      } catch {
        scopes = [];
      }
      set({ token, isAuthenticated: true, user, role, scopes });
      return true;
    }
    return false;
  },
}));
