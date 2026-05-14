import { useLoadingStore } from "@/lib/stores/loading-store";

// Production is backend-served; SSR/non-browser builds fall back to local API.
export const BASE_URL = "http://localhost:8080/api";
// export const BASE_URL =
//   typeof window !== "undefined"
//     ? `${window.location.protocol}//${window.location.host}/api`
//     : "http://localhost:8080/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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

  // Leave caller headers alone for multipart uploads.
  const callerHeaders = options.headers as Record<string, string> | undefined;
  const headers: Record<string, string> = {
    ...(callerHeaders ?? { "Content-Type": "application/json" }),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new ApiError(res.statusText, res.status);
    return {} as T;
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      useLoadingStore.getState().show("Session expired...");
      clearAuthSession();
      window.location.href = "/";
    }
    throw new ApiError("Session expired", 401);
  }
  if (res.status === 403) {
    if (typeof window !== "undefined") {
      useLoadingStore.getState().show("Redirecting...");
      window.location.href = "/dashboard";
    }
    throw new ApiError("Access denied", 403);
  }

  const json = await res.json();

  const success = json.Success ?? json.success;
  const error = json.Error ?? json.error;
  const data = json.Data ?? json.data;

  if (!res.ok || success === false) {
    throw new ApiError(error ?? "Something went wrong", res.status);
  }

  return data as T;
}

export type Paginated<T> = { items: T[]; total: number };

export function toISODate(date: string): string {
  if (!date) return date;
  return date.split("T")[0];
}

export function toISODateTime(dt: string): string {
  if (!dt) return dt;
  const timePart = dt.split("T")[1] ?? "";
  if (timePart.split(":").length < 3) {
    return `${dt}:00Z`;
  }
  if (!dt.endsWith("Z") && !dt.includes("+") && !dt.includes("-", 11)) {
    return `${dt}Z`;
  }
  return dt;
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

  // PDF endpoints return a root-served file URL.
  async openPdf(endpoint: string): Promise<void> {
    const { url } = await request<{ url: string }>(endpoint, { method: "GET" });
    if (typeof window === "undefined") return;
    const host = BASE_URL.replace(/\/api\/?$/, "");
    window.open(`${host}${url}`, "_blank", "noopener,noreferrer");
  },

  async downloadBlob(endpoint: string): Promise<Blob> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        useLoadingStore.getState().show("Session expired...");
        clearAuthSession();
        window.location.href = "/";
      }
      throw new ApiError("Session expired", 401);
    }
    if (res.status === 403) {
      if (typeof window !== "undefined") {
        useLoadingStore.getState().show("Redirecting...");
        window.location.href = "/dashboard";
      }
      throw new ApiError("Access denied", 403);
    }
    if (!res.ok) throw new ApiError(res.statusText, res.status);
    return res.blob();
  },

  // Browser supplies multipart Content-Type and boundary.
  upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    return request<T>(endpoint, {
      method: "POST",
      headers,
      body: formData,
    });
  },
};
