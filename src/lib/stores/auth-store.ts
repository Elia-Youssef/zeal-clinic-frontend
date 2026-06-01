import { create } from "zustand";
import { api, BASE_URL } from "@/lib/api";

type LoginResponse = {
  token: string;
  expiresAt: number;
  user: string;
  role: string;
  scopes: string[];
  userId: string;
  employeeId?: string;
};

type MeResponse = {
  user: string;
  role: string;
  scopes: string[];
  userId: string;
  employeeId?: string;
};

type AuthState = {
  token: string;
  isAuthenticated: boolean;
  user: string;
  role: string;
  scopes: string[];
  /** Current user's account id. */
  userId: string;
  /** Linked employee id when the account belongs to an employee, else "". */
  employeeId: string;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => boolean;
  refreshAuth: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: "",
  isAuthenticated: false,
  user: "",
  role: "",
  scopes: [],
  userId: "",
  employeeId: "",

  login: async (username, password) => {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error("Unable to connect to the server.");
    }

    let json: {
      Success?: boolean;
      Error?: string;
      Data?: LoginResponse;
    } = {};
    try {
      json = await res.json();
    } catch {
      throw new Error(res.statusText || "Login failed");
    }

    if (!res.ok || json.Success === false || !json.Data?.token) {
      throw new Error(json.Error ?? "Login failed");
    }

    sessionStorage.setItem("token", json.Data.token);
    sessionStorage.setItem("auth_user", json.Data.user);
    sessionStorage.setItem("auth_role", json.Data.role);
    sessionStorage.setItem("auth_scopes", JSON.stringify(json.Data.scopes));
    sessionStorage.setItem("auth_user_id", json.Data.userId);
    sessionStorage.setItem("auth_employee_id", json.Data.employeeId ?? "");
    set({
      token: json.Data.token,
      isAuthenticated: true,
      user: json.Data.user,
      role: json.Data.role,
      scopes: json.Data.scopes,
      userId: json.Data.userId,
      employeeId: json.Data.employeeId ?? "",
    });
  },

  logout: () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("auth_user");
    sessionStorage.removeItem("auth_role");
    sessionStorage.removeItem("auth_scopes");
    sessionStorage.removeItem("auth_user_id");
    sessionStorage.removeItem("auth_employee_id");
    set({
      token: "",
      isAuthenticated: false,
      user: "",
      role: "",
      scopes: [],
      userId: "",
      employeeId: "",
    });
  },

  // Used after a scopes_changed realtime event.
  refreshAuth: async () => {
    const data = await api.get<MeResponse>("/auth/me");
    sessionStorage.setItem("auth_user", data.user);
    sessionStorage.setItem("auth_role", data.role);
    sessionStorage.setItem("auth_scopes", JSON.stringify(data.scopes));
    sessionStorage.setItem("auth_user_id", data.userId);
    sessionStorage.setItem("auth_employee_id", data.employeeId ?? "");
    set({
      user: data.user,
      role: data.role,
      scopes: data.scopes,
      userId: data.userId,
      employeeId: data.employeeId ?? "",
    });
  },

  hydrate: () => {
    if (typeof window === "undefined") return false;
    const token = sessionStorage.getItem("token") ?? "";
    if (token) {
      const user = sessionStorage.getItem("auth_user") ?? "";
      const role = sessionStorage.getItem("auth_role") ?? "";
      const userId = sessionStorage.getItem("auth_user_id") ?? "";
      const employeeId = sessionStorage.getItem("auth_employee_id") ?? "";
      let scopes: string[] = [];
      try {
        scopes = JSON.parse(sessionStorage.getItem("auth_scopes") ?? "[]");
      } catch {
        scopes = [];
      }
      set({ token, isAuthenticated: true, user, role, scopes, userId, employeeId });
      return true;
    }
    return false;
  },
}));
