import { create } from "zustand";
import { api, BASE_URL } from "@/lib/api";
import {
  clearStoredSession,
  expiryFromLogin,
  isSessionExpired,
  readStoredExpiry,
  storeExpiry,
} from "@/lib/session-expiry";

type LoginResponse = {
  token: string;
  /** Unix seconds. */
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

/** The store with nobody signed in: at start, after a sign-out and after hydrate drops a session. */
const SIGNED_OUT = {
  token: "",
  isAuthenticated: false,
  user: "",
  role: "",
  scopes: [] as string[],
  userId: "",
  employeeId: "",
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...SIGNED_OUT,

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
    };
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
    // Counted on this browser's clock from the token's lifetime; the API's
    // own expiresAt is the fallback. See lib/session-expiry.ts.
    storeExpiry(expiryFromLogin(json.Data.token, json.Data.expiresAt));
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
    clearStoredSession();
    set(SIGNED_OUT);
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

  // The stored session is read again on every navigation and after a sign-in.
  // A stored session whose time is up is dropped like a sign-out, so nothing
  // keeps rendering for it and the caller's soft redirect keeps the way back.
  hydrate: () => {
    const token = sessionStorage.getItem("token") ?? "";
    if (token && isSessionExpired(readStoredExpiry())) {
      get().logout();
      return false;
    }
    if (token) {
      const user = sessionStorage.getItem("auth_user") ?? "";
      const role = sessionStorage.getItem("auth_role") ?? "";
      const userId = sessionStorage.getItem("auth_user_id") ?? "";
      const employeeId = sessionStorage.getItem("auth_employee_id") ?? "";
      let scopes: string[];
      try {
        scopes = JSON.parse(sessionStorage.getItem("auth_scopes") ?? "[]");
      } catch {
        scopes = [];
      }
      set({ token, isAuthenticated: true, user, role, scopes, userId, employeeId });
      return true;
    }
    // No token in this tab: the store is signed out too. The storage is left
    // as it is: the drafts in localStorage may belong to another tab's session.
    set(SIGNED_OUT);
    return false;
  },
}));
