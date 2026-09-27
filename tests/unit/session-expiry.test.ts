// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/api";
import {
  expiryFromLogin,
  isSessionExpired,
  parseStoredExpiry,
  settleExpiredSession,
  tokenLifetimeSeconds,
} from "@/lib/session-expiry";
import { useFormDraftsStore } from "@/lib/stores/form-drafts-store";
import { useLoadingStore } from "@/lib/stores/loading-store";

const SESSION_KEYS = [
  "auth_employee_id",
  "auth_expires_at",
  "auth_role",
  "auth_scopes",
  "auth_user",
  "auth_user_id",
  "token",
];

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jwt(payload: unknown): string {
  return `${base64Url('{"alg":"HS256","typ":"JWT"}')}.${base64Url(JSON.stringify(payload))}.sig`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function seedSession(expiresAt = "1700000000") {
  sessionStorage.setItem("token", "tok-123");
  sessionStorage.setItem("auth_user", "Test User");
  sessionStorage.setItem("auth_role", "staff");
  sessionStorage.setItem("auth_scopes", '["patients:read"]');
  sessionStorage.setItem("auth_user_id", "user-1");
  sessionStorage.setItem("auth_employee_id", "");
  sessionStorage.setItem("auth_expires_at", expiresAt);
}

function stubLocation() {
  const location = { href: "http://localhost:3000/patients" };
  vi.stubGlobal("location", location);
  return location;
}

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
  localStorage.clear();
  useLoadingStore.getState().reset();
  useFormDraftsStore.setState({ drafts: {} });
});

describe("tokenLifetimeSeconds", () => {
  it("reads exp - iat from the payload without checking the signature", () => {
    expect(tokenLifetimeSeconds(jwt({ iat: 1_700_000_000, exp: 1_700_050_400 }))).toBe(50_400);
    expect(tokenLifetimeSeconds(jwt({ sub: "user-1", iat: 5, exp: 65, name: "Zoë Ångström" }))).toBe(60);
  });

  it("decodes the base64url alphabet", () => {
    // A payload whose base64 holds "+" and "/" characters.
    const payload = '{"iat":1,"exp":2,"x":"???>>>"}';
    expect(btoa(payload)).toMatch(/[+/]/);
    expect(tokenLifetimeSeconds(jwt(JSON.parse(payload)))).toBe(1);
  });

  it("is null without both claims, for a non-JWT token and for an unreadable payload", () => {
    expect(tokenLifetimeSeconds(jwt({ exp: 1_700_050_400 }))).toBeNull();
    expect(tokenLifetimeSeconds(jwt({ iat: "1700000000", exp: 1_700_050_400 }))).toBeNull();
    expect(tokenLifetimeSeconds(jwt({ iat: 10, exp: 10 }))).toBeNull();
    expect(tokenLifetimeSeconds("tok-123")).toBeNull();
    expect(tokenLifetimeSeconds("a.b")).toBeNull();
    expect(tokenLifetimeSeconds("a.!!!.c")).toBeNull();
    expect(tokenLifetimeSeconds(`a.${base64Url("not json")}.c`)).toBeNull();
    expect(tokenLifetimeSeconds("")).toBeNull();
  });
});

describe("expiryFromLogin", () => {
  const nowMs = Date.parse("2026-06-15T12:00:00Z");

  it("adds the token's lifetime to the browser's clock", () => {
    const token = jwt({ iat: 1_700_000_000, exp: 1_700_050_400 });
    expect(expiryFromLogin(token, 1_700_050_400, nowMs)).toBe(nowMs / 1000 + 50_400);
    expect(expiryFromLogin(token, 1_700_050_400, nowMs + 999)).toBe(nowMs / 1000 + 50_400);
  });

  it("falls back to the numeric expiresAt in Unix seconds, else null", () => {
    expect(expiryFromLogin("tok-123", 1_893_456_000, nowMs)).toBe(1_893_456_000);
    expect(expiryFromLogin("tok-123", "1893456000", nowMs)).toBe(1_893_456_000);
    expect(expiryFromLogin("tok-123", 1_893_456_000.9, nowMs)).toBe(1_893_456_000);
    expect(expiryFromLogin("tok-123", undefined, nowMs)).toBeNull();
    expect(expiryFromLogin("tok-123", "", nowMs)).toBeNull();
    expect(expiryFromLogin("tok-123", "soon", nowMs)).toBeNull();
    expect(expiryFromLogin("tok-123", 0, nowMs)).toBeNull();
    expect(expiryFromLogin("tok-123", true, nowMs)).toBeNull();
  });
});

describe("parseStoredExpiry and isSessionExpired", () => {
  it("reads Unix seconds and date strings", () => {
    expect(parseStoredExpiry("1893456000")).toBe(1_893_456_000_000);
    expect(parseStoredExpiry(" 1893456000 ")).toBe(1_893_456_000_000);
    expect(parseStoredExpiry("2026-06-15T11:59:59Z")).toBe(Date.parse("2026-06-15T11:59:59Z"));
  });

  it("is null for nothing or nonsense", () => {
    expect(parseStoredExpiry(null)).toBeNull();
    expect(parseStoredExpiry(undefined)).toBeNull();
    expect(parseStoredExpiry("")).toBeNull();
    expect(parseStoredExpiry("   ")).toBeNull();
    expect(parseStoredExpiry("tomorrow")).toBeNull();
  });

  it("expires at the stored instant, never without one", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    expect(isSessionExpired("1700000000", now)).toBe(true);
    expect(isSessionExpired(String(now / 1000), now)).toBe(true);
    expect(isSessionExpired(String(now / 1000 + 1), now)).toBe(false);
    expect(isSessionExpired("2026-06-15T12:00:01Z", now)).toBe(false);
    expect(isSessionExpired("", now)).toBe(false);
    expect(isSessionExpired(null, now)).toBe(false);
  });
});

describe("settleExpiredSession", () => {
  it("keeps the session and drops the estimate when the server still accepts the token", async () => {
    seedSession();
    const location = stubLocation();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ Success: true, Data: { user: "Test User" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(settleExpiredSession(10)).resolves.toBe("kept");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/auth/verify`);
    expect(sessionStorage.getItem("token")).toBe("tok-123");
    expect(sessionStorage.getItem("auth_expires_at")).toBe("");
    expect(location.href).toBe("http://localhost:3000/patients");
    expect(useLoadingStore.getState().count).toBe(0);
  });

  it("ends the session through the 401 path when the server refuses the token", async () => {
    seedSession();
    const location = stubLocation();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ Success: false, Error: "Unauthorized" }, 401)));
    useFormDraftsStore.getState().saveDraft("patient", { id: "d1", label: "Draft", data: {} });

    await expect(settleExpiredSession(10)).resolves.toBe("ended");

    for (const key of SESSION_KEYS) expect(sessionStorage.getItem(key), key).toBeNull();
    expect(useFormDraftsStore.getState().drafts).toEqual({});
    expect(location.href).toBe("/");
    expect(useLoadingStore.getState()).toMatchObject({ count: 1, message: "Session expired" });
  });

  it("tries once more after a network error and keeps the session when that works", async () => {
    vi.useFakeTimers();
    seedSession();
    const location = stubLocation();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ Success: true, Data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const settled = settleExpiredSession(30_000);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(settled).resolves.toBe("kept");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem("token")).toBe("tok-123");
    expect(location.href).toBe("http://localhost:3000/patients");
  });

  it("ends the session when the server can't be reached twice in a row", async () => {
    vi.useFakeTimers();
    seedSession();
    const location = stubLocation();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const settled = settleExpiredSession(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(settled).resolves.toBe("ended");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const key of SESSION_KEYS) expect(sessionStorage.getItem(key), key).toBeNull();
    expect(location.href).toBe("/");
    expect(useLoadingStore.getState()).toMatchObject({ count: 1, message: "Session expired" });
  });

  it("does nothing once the user has signed out", async () => {
    const location = stubLocation();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(settleExpiredSession(10)).resolves.toBe("ended");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(location.href).toBe("http://localhost:3000/patients");
    expect(useLoadingStore.getState().count).toBe(0);
  });
});
