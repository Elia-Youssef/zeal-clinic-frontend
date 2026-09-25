import { randomBytes } from "node:crypto";

/** A random password for accounts that exist only for one run. */
export function throwawayPassword(): string {
  return randomBytes(18).toString("base64url");
}

/** The sign-in response, as the dashboard stores it. */
export type Session = {
  token: string;
  expiresAt: number;
  userId: string;
  user: string;
  role: string;
  scopes: string[];
  employeeId?: string;
};

type Envelope<T> = { Success?: boolean; Data?: T; Error?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** An API call that answered with an error; `status` and the server's message are kept for assertions. */
export class ApiError extends Error {
  readonly status: number;
  readonly serverMessage: string;

  constructor(status: number, serverMessage: string, call: string) {
    super(`${call} failed: HTTP ${status} ${serverMessage}`.trim());
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/** Signs in through the API. Sign-ins are limited to 10 per minute per IP, so a 429 waits and retries. */
export async function apiLogin(baseURL: string, username: string, password: string): Promise<Session> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.status === 429 && attempt < 12) {
      await sleep(7_000);
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as Envelope<Session>;
    if (!res.ok || !body.Data?.token) {
      throw new ApiError(res.status, body.Error ?? "", `sign-in as ${username}`);
    }
    return body.Data;
  }
}

/** Revokes a token the way the dashboard's sign-out does. */
export async function apiLogout(baseURL: string, token: string): Promise<void> {
  await fetch(`${baseURL}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

export async function apiRequest<T>(
  baseURL: string,
  token: string,
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${baseURL}/api${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || parsed.Success === false) {
    throw new ApiError(res.status, parsed.Error ?? "", `${method} /api${endpoint}`);
  }
  return parsed.Data as T;
}

export async function apiGet<T>(baseURL: string, token: string, endpoint: string): Promise<T> {
  return apiRequest<T>(baseURL, token, "GET", endpoint);
}

/** The items of a list response ({items, total}) or of a plain array. */
export function listItems<T>(data: { items?: T[] } | T[] | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

/** The 7 sessionStorage entries the dashboard writes after a sign-in (src/lib/stores/auth-store.ts). */
export function sessionEntries(session: Session): [string, string][] {
  return [
    ["token", session.token],
    ["auth_user", session.user],
    ["auth_role", session.role],
    ["auth_scopes", JSON.stringify(session.scopes)],
    ["auth_user_id", session.userId],
    ["auth_employee_id", session.employeeId ?? ""],
    ["auth_expires_at", String(session.expiresAt ?? "")],
  ];
}
