import { useEffect } from "react";
import { settleExpiredSession } from "@/lib/session-expiry-settle";
import { parseStoredExpiry, readStoredExpiry } from "@/lib/session-expiry";

// setTimeout can't wait longer than this, so longer waits are taken in steps.
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Waits for the client-side session expiry while the signed-in shell is
 * mounted, then lets the server confirm or refute it (settleExpiredSession).
 * Sessions without a stored expiry end on the server's 401 only.
 */
export function SessionExpiryWatch() {
  useEffect(() => {
    const expiry = parseStoredExpiry(readStoredExpiry());
    if (expiry === null) return;
    let handle = 0;
    const wait = () => {
      const remaining = expiry - Date.now();
      handle = window.setTimeout(
        () => {
          if (Date.now() < expiry) wait();
          else void settleExpiredSession();
        },
        Math.max(0, Math.min(remaining, MAX_TIMEOUT_MS)),
      );
    };
    wait();
    return () => window.clearTimeout(handle);
  }, []);

  return null;
}
