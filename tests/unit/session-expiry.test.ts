// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  expiryFromLogin,
  isSessionExpired,
  parseStoredExpiry,
  tokenLifetimeSeconds,
} from "@/lib/session-expiry";

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jwt(payload: unknown): string {
  return `${base64Url('{"alg":"HS256","typ":"JWT"}')}.${base64Url(JSON.stringify(payload))}.sig`;
}

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
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
  it("reads Unix seconds", () => {
    expect(parseStoredExpiry("1893456000")).toBe(1_893_456_000_000);
    expect(parseStoredExpiry(" 1893456000 ")).toBe(1_893_456_000_000);
  });

  it("is null for nothing, nonsense and anything but Unix seconds", () => {
    expect(parseStoredExpiry(null)).toBeNull();
    expect(parseStoredExpiry(undefined)).toBeNull();
    expect(parseStoredExpiry("")).toBeNull();
    expect(parseStoredExpiry("   ")).toBeNull();
    expect(parseStoredExpiry("tomorrow")).toBeNull();
    expect(parseStoredExpiry("2026-06-15T12:00:01Z")).toBeNull();
  });

  it("expires at the stored instant, never without one", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    expect(isSessionExpired("1700000000", now)).toBe(true);
    expect(isSessionExpired(String(now / 1000), now)).toBe(true);
    expect(isSessionExpired(String(now / 1000 + 1), now)).toBe(false);
    expect(isSessionExpired("", now)).toBe(false);
    expect(isSessionExpired(null, now)).toBe(false);
  });
});
