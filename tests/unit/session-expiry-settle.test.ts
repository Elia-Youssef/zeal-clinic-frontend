// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/api";
import { settleExpiredSession } from "@/lib/session-expiry-settle";
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
