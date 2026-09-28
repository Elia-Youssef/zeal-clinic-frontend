import { api, expireSession } from "@/lib/api";
import { storeExpiry } from "@/lib/session-expiry";

// Here rather than beside the storage helpers in lib/session-expiry.ts: this
// talks to the API, and the API layer itself uses those helpers, so the two
// modules must not import each other.

/** Pause before the second server check when the first one fails to reach the server. */
export const VERIFY_RETRY_MS = 30_000;

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
      storeExpiry(null);
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
