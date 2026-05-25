import { useLoadingStore } from "@/lib/stores/loading-store";
import { wallClockToUtc } from "@/lib/tz";

export const BASE_URL = import.meta.env.DEV
  ? "http://localhost:8080/api"
  : typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/api`
    : "";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("token") ?? "";
}

function clearAuthSession(): void {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("auth_user");
  sessionStorage.removeItem("auth_role");
  sessionStorage.removeItem("auth_scopes");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      useLoadingStore.getState().show("Session expired");
      clearAuthSession();
      window.location.href = "/";
    }
    throw new Error("Session expired");
  }
  if (res.status === 403) {
    if (typeof window !== "undefined") {
      useLoadingStore.getState().show("Redirecting");
      window.location.href = "/dashboard";
    }
    throw new Error("Access denied");
  }

  const json = await res.json();
  if (!res.ok || json.Success === false) {
    throw new Error(json.Error ?? "Something went wrong");
  }
  return json.Data as T;
}

export type Paginated<T> = { items: T[]; total: number };

export function toISODate(date: string): string {
  if (!date) return date;
  return date.split("T")[0];
}

// Picker values represent Beirut wall-clock; convert to UTC RFC3339 before
// sending. If the value already carries an explicit offset (Z or +/-HH:MM),
// trust it as-is.
export function toISODateTime(dt: string): string {
  if (!dt) return dt;
  if (dt.endsWith("Z") || dt.includes("+") || dt.includes("-", 11)) {
    return dt;
  }
  return wallClockToUtc(dt);
}

export const api = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "GET" });
  },

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  del<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "DELETE" });
  },

  async openPdf(endpoint: string): Promise<void> {
    const { url } = await request<{ url: string }>(endpoint, { method: "GET" });
    if (typeof window === "undefined") return;
    const host = BASE_URL.replace(/\/api\/?$/, "");
    window.open(
      `${host}${url}?access_token=${getToken()}`,
      "_blank",
      "noopener,noreferrer",
    );
  },
};
