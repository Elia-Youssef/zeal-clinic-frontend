/**
 * api.ts: Centralized fetch wrapper for the clinic backend.
 *
 * Every API call goes through `api.*` helpers so that:
 *  - The JWT token is attached automatically from sessionStorage.
 *  - The standard `{ success, data, error }` envelope is unwrapped.
 *  - Network / HTTP errors surface as thrown `ApiError` instances.
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const patients = await api.get<Patient[]>("/patients");
 *   const created  = await api.post<Patient>("/patients", body);
 */

import { useLoadingStore } from "@/lib/stores/loading-store";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

/**
 * Base URL for all API requests.
 * The frontend is served by the backend, so derive the API origin from
 * the page's own host. Falls back to localhost during SSR / non-browser builds.
 */
export const BASE_URL = "http://localhost:8080/api";
// export const BASE_URL =
//   typeof window !== "undefined"
//     ? `${window.location.protocol}//${window.location.host}/api`
//     : "http://localhost:8080/api";

/* ------------------------------------------------------------------ */
/*  Error type                                                         */
/* ------------------------------------------------------------------ */

/** Custom error thrown when an API call fails (network, HTTP, or backend error). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/** Read the JWT token stored at login. Returns empty string if absent. */
function getToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("token") ?? "";
}

/** Clear auth session data after the backend rejects the current token. */
function clearAuthSession(): void {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("auth_user");
  sessionStorage.removeItem("auth_role");
  sessionStorage.removeItem("auth_scopes");
}

/**
 * Core fetch wrapper.
 * - Attaches Authorization header when a token exists.
 * - Parses the JSON envelope `{ success, data, error }`.
 * - Throws `ApiError` on failure so callers can try/catch.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  /*
   * Build headers, including the auth token when we have one.
   * Only set Content-Type to JSON when the caller hasn't provided headers
   * (e.g. multipart uploads need the browser to set the boundary).
   */
  const callerHeaders = options.headers as Record<string, string> | undefined;
  const headers: Record<string, string> = {
    ...(callerHeaders ?? { "Content-Type": "application/json" }),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  /* Make the request */
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  /* Handle non-JSON responses (e.g. 204 No Content) */
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new ApiError(res.statusText, res.status);
    return {} as T;
  }

  /* Handle auth / authorization redirects */
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

  /* Parse the standard backend envelope */
  const json = await res.json();

  const success = json.Success ?? json.success;
  const error = json.Error ?? json.error;
  const data = json.Data ?? json.data;

  if (!res.ok || success === false) {
    throw new ApiError(error ?? "Something went wrong", res.status);
  }

  /* Return just the payload; callers never see the envelope */
  return data as T;
}

/* ------------------------------------------------------------------ */
/*  Shared response types                                              */
/* ------------------------------------------------------------------ */

/** Shape returned by paginated list endpoints (?offset=&limit=&filter=). */
export type Paginated<T> = { items: T[]; total: number };

/* ------------------------------------------------------------------ */
/*  Date formatting helpers                                            */
/* ------------------------------------------------------------------ */

/** Ensure a date string is sent as YYYY-MM-DD (strip any time component). */
export function toISODate(date: string): string {
  if (!date) return date;
  return date.split("T")[0];
}

/** Convert a datetime-local string (YYYY-MM-DDTHH:mm) to ISO 8601 (YYYY-MM-DDTHH:mm:00Z). */
export function toISODateTime(dt: string): string {
  if (!dt) return dt;
  // Count colons in the time part to check if seconds are present
  const timePart = dt.split("T")[1] ?? "";
  if (timePart.split(":").length < 3) {
    return `${dt}:00Z`;
  }
  // Already has seconds: ensure trailing Z
  if (!dt.endsWith("Z") && !dt.includes("+") && !dt.includes("-", 11)) {
    return `${dt}Z`;
  }
  return dt;
}

/* ------------------------------------------------------------------ */
/*  Public helpers, one per HTTP method                                */
/* ------------------------------------------------------------------ */

export const api = {
  /** GET request: fetch data from the given endpoint. */
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "GET" });
  },

  /** POST request: create a resource or trigger an action. */
  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /** PUT request: update an existing resource. */
  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /** PATCH request: partially update an existing resource. */
  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /** DELETE request: remove a resource. */
  del<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "DELETE" });
  },

  /**
   * Call a PDF generation endpoint that returns `{ url: "/files/<name>.pdf" }`
   * and open the resulting file in a new tab. Files are served at the host
   * root (not under /api) and require no auth.
   */
  async openPdf(endpoint: string): Promise<void> {
    const { url } = await request<{ url: string }>(endpoint, { method: "GET" });
    if (typeof window === "undefined") return;
    const host = BASE_URL.replace(/\/api\/?$/, "");
    window.open(`${host}${url}`, "_blank", "noopener,noreferrer");
  },

  /** Download a binary response as a Blob (e.g. PDF files). */
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

  /**
   * Upload a file via multipart/form-data (e.g. appointment photos).
   * Unlike post(), this does NOT set Content-Type; the browser adds
   * the correct multipart boundary automatically from the FormData.
   */
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
