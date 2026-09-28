import { useLoadingStore } from "@/lib/stores/loading-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { clearStoredSession } from "@/lib/session-expiry";
import { wallClockToUtc } from "@/lib/tz";

/** Per-call options. `silent` suppresses the default 403 permission alert for
 *  background/optional fetches that already tolerate failure on their own. */
export type RequestConfig = { silent?: boolean };

// In development the Vite server talks to a separately running API:
// http://localhost:55555 unless VITE_API_BASE_URL (see .env.example) names
// another origin. A production build is served by the API itself and calls its
// own origin; the variable plays no part there.
const DEV_API_ORIGIN = "http://localhost:55555";

function devApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
  return `${configured || DEV_API_ORIGIN}/api`;
}

export const BASE_URL = import.meta.env.DEV
  ? devApiBase()
  : `${window.location.protocol}//${window.location.host}/api`;

function getToken(): string {
  return sessionStorage.getItem("token") ?? "";
}

/** Ends the session the way a 401 does: the overlay says why, the stored
 *  session (see lib/session-expiry.ts) goes, and the browser returns to the
 *  sign-in page. */
export function expireSession(): void {
  useLoadingStore.getState().show("Session expired");
  clearStoredSession();
  window.location.href = "/";
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  config: RequestConfig = {},
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
    expireSession();
    throw new Error("Session expired");
  }
  // A 403 doesn't redirect: page-level access is enforced by route guards
  // (RequireScopes). Here we just surface a permission alert and throw so the
  // caller's own catch path can degrade gracefully. The stable toast id dedupes
  // a burst of forbidden fetches into a single message.
  if (res.status === 403) {
    if (!config.silent) {
      useAlertStore
        .getState()
        .addAlert("error", "You don't have permission to do that.", "forbidden");
    }
    throw new Error("Access denied");
  }

  const json = await res.json();
  if (!res.ok || json.Success === false || json.success === false) {
    throw new Error(json.Error ?? json.error ?? "Something went wrong");
  }
  return (json.Data ?? json.data) as T;
}

export type Paginated<T> = { items: T[]; total: number };

export function toISODate(date: string): string {
  if (!date) return date;
  return date.split("T")[0];
}

const OFFSET_DATE_TIME = /(?:Z|[+-]\d{2}:\d{2})$/i;

// Picker values represent Beirut wall-clock; convert to UTC RFC3339 before
// sending. Explicit-offset values are normalized as well, so every outgoing
// appointment timestamp uses the same `Z` UTC representation.
export function toISODateTime(dt: string): string {
  if (!dt) return dt;
  if (OFFSET_DATE_TIME.test(dt)) {
    const parsed = new Date(dt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Invalid date and time.");
    }
    return parsed.toISOString();
  }
  return wallClockToUtc(dt);
}

export const api = {
  get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return request<T>(endpoint, { method: "GET" }, config);
  },

  post<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>(
      endpoint,
      {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      },
      config,
    );
  },

  put<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>(
      endpoint,
      {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
      },
      config,
    );
  },

  patch<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig,
  ): Promise<T> {
    return request<T>(
      endpoint,
      {
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
      },
      config,
    );
  },

  del<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return request<T>(endpoint, { method: "DELETE" }, config);
  },

  async openPdf(endpoint: string, config?: RequestConfig): Promise<void> {
    const { url } = await request<{ url: string }>(
      endpoint,
      { method: "GET" },
      config,
    );
    const host = BASE_URL.replace(/\/api\/?$/, "");
    const token = getToken();
    const res = await fetch(`${host}${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error("Unable to open the document.");
    }
    const blobUrl = URL.createObjectURL(await res.blob());
    // No noopener/noreferrer: they make window.open() return null even on
    // success, which would falsely trip the download fallback below.
    const win = window.open(blobUrl, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "document.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  },
};
