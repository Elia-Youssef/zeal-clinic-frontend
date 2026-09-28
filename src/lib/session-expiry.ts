import { clearFormDrafts } from "@/lib/stores/form-drafts-store";
import { clearNotifications } from "@/lib/stores/notifications-store";

// A sign-in answers with `expiresAt` (Unix seconds) and a JWT whose payload
// carries `iat` and `exp`. The client keeps its own expiry, as Unix seconds in
// sessionStorage, counted on the browser's clock from the token's lifetime
// (exp - iat), so a clock difference between the server and the browser
// neither cuts a session short nor stretches it. The server still has the last
// word: the expiry watcher asks it before ending a session.

/** The sessionStorage key the expiry is stored under. */
const EXPIRES_AT_KEY = "auth_expires_at";

/** The stored session's other keys; the form drafts live in localStorage beside them. */
const SESSION_KEYS = [
  "token",
  "auth_user",
  "auth_role",
  "auth_scopes",
  "auth_user_id",
  "auth_employee_id",
  EXPIRES_AT_KEY,
];

/** The stored expiry exactly as stored ("" once dropped), or null when absent. */
export function readStoredExpiry(): string | null {
  return sessionStorage.getItem(EXPIRES_AT_KEY);
}

/**
 * Stores the expiry of a sign-in as Unix seconds; null drops it back to none,
 * which is what a kept session does once the server overruled the estimate.
 */
export function storeExpiry(expiresAt: number | null): void {
  sessionStorage.setItem(
    EXPIRES_AT_KEY,
    expiresAt === null ? "" : String(expiresAt),
  );
}

/**
 * Clears the stored session the way a sign-out does: every session key, the
 * form drafts and the account's notifications (the bell's panel closes too).
 * Sign-out and every expiry path go through here.
 */
export function clearStoredSession(): void {
  for (const key of SESSION_KEYS) sessionStorage.removeItem(key);
  clearFormDrafts();
  clearNotifications();
}

type JwtPayload = { iat?: unknown; exp?: unknown };

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * The token's lifetime in seconds (exp - iat) read from its payload, or null
 * when the token is not a JWT carrying both claims. The signature is not
 * checked here; the server checks it on every request.
 */
export function tokenLifetimeSeconds(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
    if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
      return null;
    }
    const lifetime = payload.exp - payload.iat;
    return Number.isFinite(lifetime) && lifetime > 0 ? lifetime : null;
  } catch {
    return null;
  }
}

/**
 * The expiry to store after a sign-in, as Unix seconds: now plus the token's
 * lifetime, else the API's own `expiresAt` (Unix seconds), else null.
 */
export function expiryFromLogin(
  token: string,
  expiresAt: unknown,
  nowMs = Date.now(),
): number | null {
  const lifetime = tokenLifetimeSeconds(token);
  if (lifetime !== null) return Math.floor(nowMs / 1000) + lifetime;
  if (typeof expiresAt !== "number" && typeof expiresAt !== "string") {
    return null;
  }
  const fallback = Number(expiresAt);
  return Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : null;
}

/**
 * The stored expiry as epoch milliseconds: Unix seconds, the format written at
 * sign-in; null when absent or not in that format.
 */
export function parseStoredExpiry(raw: string | null | undefined): number | null {
  const text = raw?.trim();
  if (!text || !/^\d+(\.\d+)?$/.test(text)) return null;
  return Number(text) * 1000;
}

export function isSessionExpired(
  raw: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  const expiry = parseStoredExpiry(raw);
  return expiry !== null && nowMs >= expiry;
}
