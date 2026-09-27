import { api, expireSession } from "@/lib/api";

// A sign-in answers with `expiresAt` (Unix seconds) and a JWT whose payload
// carries `iat` and `exp`. The client keeps its own expiry, as Unix seconds in
// sessionStorage, counted on the browser's clock from the token's lifetime
// (exp - iat), so a clock difference between the server and the browser
// neither cuts a session short nor stretches it. The server still has the last
// word: see settleExpiredSession.

export const EXPIRES_AT_KEY = "auth_expires_at";

/** Pause before the second server check when the first one fails to reach the server. */
export const VERIFY_RETRY_MS = 30_000;

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
 * The stored expiry as epoch milliseconds: Unix seconds (the format written at
 * sign-in) or a date string; null when absent or unreadable.
 */
export function parseStoredExpiry(raw: string | null | undefined): number | null {
  const text = raw?.trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text) * 1000;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSessionExpired(
  raw: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  const expiry = parseStoredExpiry(raw);
  return expiry !== null && nowMs >= expiry;
}

/**
 * Called once the client-side expiry has passed while the app is open. The
 * server decides: when `GET /auth/verify` still accepts the token, the client's
 * estimate was wrong, so it is dropped and the session goes on until the server
 * answers 401 (the shared 401 path ends it then). A 401 now ends it through
 * that same path. When the server can't be reached, one more attempt follows
 * after `retryDelayMs`; a second failure ends the session like a 401 would.
 */
export async function settleExpiredSession(
  retryDelayMs = VERIFY_RETRY_MS,
): Promise<"kept" | "ended"> {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Signed out meanwhile (or the 401 path already cleared the session).
    if (!sessionStorage.getItem("token")) return "ended";
    try {
      await api.get("/auth/verify");
      sessionStorage.setItem(EXPIRES_AT_KEY, "");
      return "kept";
    } catch {
      if (!sessionStorage.getItem("token")) return "ended";
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  expireSession();
  return "ended";
}
