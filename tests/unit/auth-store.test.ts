// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
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

const LOGIN = {
  token: "tok-123",
  // The API sends the expiry as Unix seconds.
  expiresAt: 1_893_456_000,
  user: "Test User",
  role: "staff",
  scopes: ["patients:read", "appointments:write"],
  userId: "user-1",
  employeeId: "emp-1",
};

const SIGNED_OUT = {
  token: "",
  isAuthenticated: false,
  user: "",
  role: "",
  scopes: [],
  userId: "",
  employeeId: "",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** An unsigned JWT-shaped token: the payload is what the client reads. */
function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

function sessionKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) keys.push(sessionStorage.key(i) ?? "");
  return keys.sort();
}

function storeSession(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) sessionStorage.setItem(key, value);
}

const STORED_SESSION = {
  token: "tok-123",
  auth_user: "Test User",
  auth_role: "staff",
  auth_scopes: '["patients:read"]',
  auth_user_id: "user-1",
  auth_employee_id: "",
};

beforeEach(() => {
  useAuthStore.setState(SIGNED_OUT);
  useFormDraftsStore.setState({ drafts: {} });
  useLoadingStore.getState().reset();
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("login", () => {
  it("posts the credentials and stores the session in the seven sessionStorage keys", async () => {
    const fetchMock = stubFetch(jsonResponse({ Success: true, Data: LOGIN }));

    await useAuthStore.getState().login("test.user", "secret");

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"username":"test.user","password":"secret"}',
    });
    expect(sessionKeys()).toEqual(SESSION_KEYS);
    expect(sessionStorage.getItem("token")).toBe("tok-123");
    expect(sessionStorage.getItem("auth_scopes")).toBe('["patients:read","appointments:write"]');
    expect(sessionStorage.getItem("auth_expires_at")).toBe("1893456000");
    expect(sessionStorage.getItem("auth_employee_id")).toBe("emp-1");
    expect(localStorage.length).toBe(0);
    expect(useAuthStore.getState()).toMatchObject({
      token: "tok-123",
      isAuthenticated: true,
      user: "Test User",
      role: "staff",
      scopes: ["patients:read", "appointments:write"],
      userId: "user-1",
      employeeId: "emp-1",
    });
  });

  it("counts the expiry from the token's lifetime on the browser's clock", async () => {
    // The server's clock is far behind the browser's: its exp would already be
    // in the past here, while the token has a full 14 hours to live.
    const NOW = "2026-06-15T12:00:00Z";
    vi.setSystemTime(NOW);
    const iat = 1_700_000_000;
    const lifetime = 14 * 3600;
    stubFetch(
      jsonResponse({
        Success: true,
        Data: { ...LOGIN, token: jwt({ iat, exp: iat + lifetime }), expiresAt: iat + lifetime },
      }),
    );

    await useAuthStore.getState().login("test.user", "secret");

    expect(sessionStorage.getItem("auth_expires_at")).toBe(String(Date.parse(NOW) / 1000 + lifetime));
    expect(sessionKeys()).toEqual(SESSION_KEYS);
  });

  it("falls back to the API's expiresAt when the token carries no lifetime", async () => {
    stubFetch(
      jsonResponse({ Success: true, Data: { ...LOGIN, token: jwt({ sub: "user-1" }) } }),
      jsonResponse({ Success: true, Data: { ...LOGIN, token: "a.b.c" } }),
      jsonResponse({ Success: true, Data: { ...LOGIN, expiresAt: undefined } }),
    );

    await useAuthStore.getState().login("test.user", "secret");
    expect(sessionStorage.getItem("auth_expires_at")).toBe("1893456000");

    await useAuthStore.getState().login("test.user", "secret");
    expect(sessionStorage.getItem("auth_expires_at")).toBe("1893456000");

    await useAuthStore.getState().login("test.user", "secret");
    expect(sessionStorage.getItem("auth_expires_at")).toBe("");
    expect(sessionKeys()).toEqual(SESSION_KEYS);
  });

  it("stores an empty employee id for accounts without an employee", async () => {
    // The JSON round trip drops the undefined field.
    const withoutEmployee = { ...LOGIN, employeeId: undefined };
    stubFetch(jsonResponse({ Success: true, Data: withoutEmployee }));
    await useAuthStore.getState().login("test.user", "secret");
    expect(sessionStorage.getItem("auth_employee_id")).toBe("");
    expect(useAuthStore.getState().employeeId).toBe("");
  });

  it("throws the server's message and stores nothing when the login is refused", async () => {
    const location = { href: "http://localhost:3000/" };
    vi.stubGlobal("location", location);
    stubFetch(jsonResponse({ Success: false, Error: "Invalid username or password" }, 401));

    await expect(useAuthStore.getState().login("test.user", "wrong")).rejects.toThrow(
      "Invalid username or password",
    );
    expect(sessionKeys()).toEqual([]);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    // A refused login is not a session expiry: no redirect, no overlay.
    expect(location.href).toBe("http://localhost:3000/");
    expect(useLoadingStore.getState().count).toBe(0);
  });

  it("explains connection, parse and missing-token failures", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("offline")));
    await expect(useAuthStore.getState().login("a", "b")).rejects.toThrow(
      "Unable to connect to the server.",
    );

    stubFetch(
      new Response("<html></html>", { status: 502, statusText: "Bad Gateway" }),
      new Response("<html></html>", { status: 502 }),
      jsonResponse({ Success: true, Data: { ...LOGIN, token: "" } }),
    );
    await expect(useAuthStore.getState().login("a", "b")).rejects.toThrow("Bad Gateway");
    await expect(useAuthStore.getState().login("a", "b")).rejects.toThrow("Login failed");
    await expect(useAuthStore.getState().login("a", "b")).rejects.toThrow("Login failed");
    expect(sessionKeys()).toEqual([]);
  });
});

describe("logout", () => {
  it("clears the session keys and the drafts but nothing else", () => {
    storeSession({ ...STORED_SESSION, auth_expires_at: "1893456000", auth_redirect: "/rooms" });
    localStorage.setItem("ui-settings", "{}");
    useFormDraftsStore.getState().saveDraft("patient", { id: "d1", label: "Draft", data: {} });
    useAuthStore.setState({ token: "tok-123", isAuthenticated: true, scopes: ["rooms:read"] });

    useAuthStore.getState().logout();

    expect(sessionKeys()).toEqual(["auth_redirect"]);
    expect(localStorage.getItem("form-drafts")).toBeNull();
    expect(localStorage.getItem("ui-settings")).toBe("{}");
    expect(useFormDraftsStore.getState().drafts).toEqual({});
    expect(useAuthStore.getState()).toMatchObject(SIGNED_OUT);
  });
});

describe("hydrate", () => {
  it("returns false and changes nothing without a token", () => {
    storeSession({ auth_user: "Test User" });
    expect(useAuthStore.getState().hydrate()).toBe(false);
    expect(useAuthStore.getState()).toMatchObject(SIGNED_OUT);
  });

  it("restores the session from sessionStorage", () => {
    storeSession({ ...STORED_SESSION, auth_employee_id: "emp-1" });
    expect(useAuthStore.getState().hydrate()).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      token: "tok-123",
      isAuthenticated: true,
      user: "Test User",
      role: "staff",
      scopes: ["patients:read"],
      userId: "user-1",
      employeeId: "emp-1",
    });
  });

  it("falls back to no scopes when the stored list is not JSON", () => {
    storeSession({ ...STORED_SESSION, auth_scopes: "patients:read" });
    expect(useAuthStore.getState().hydrate()).toBe(true);
    expect(useAuthStore.getState().scopes).toEqual([]);
  });

  it("keeps a session without an expiry", () => {
    storeSession(STORED_SESSION);
    expect(useAuthStore.getState().hydrate()).toBe(true);
  });

  it("keeps a session whose stored expiry is not Unix seconds", () => {
    // Nothing writes that format; anything unreadable counts as no expiry.
    vi.setSystemTime("2026-06-15T12:00:00Z");
    storeSession({ ...STORED_SESSION, auth_expires_at: "2026-06-15T11:59:59Z" });
    expect(useAuthStore.getState().hydrate()).toBe(true);
  });

  // The expiry is stored as Unix seconds (the API's own format).
  it("keeps a session whose Unix-seconds expiry is still ahead", () => {
    vi.setSystemTime("2026-06-15T12:00:00Z");
    storeSession({ ...STORED_SESSION, auth_expires_at: "1893456000" });
    expect(useAuthStore.getState().hydrate()).toBe(true);
    expect(sessionStorage.getItem("token")).toBe("tok-123");
  });

  it("drops a session whose Unix-seconds expiry has passed", () => {
    vi.setSystemTime("2026-06-15T12:00:00Z");
    storeSession({ ...STORED_SESSION, auth_expires_at: "1700000000" });
    localStorage.setItem("form-drafts", '{"state":{"drafts":{}},"version":0}');

    expect(useAuthStore.getState().hydrate()).toBe(false);
    expect(sessionKeys()).toEqual([]);
    expect(localStorage.getItem("form-drafts")).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  // The gate renders the app while the store says signed in, so dropping a
  // session must sign the store out, not only clear the stored keys.
  it("signs the store out when it drops a session that has expired since it was restored", () => {
    vi.setSystemTime("2026-06-15T12:00:00Z");
    const expiresAt = String(Date.parse("2026-06-15T13:00:00Z") / 1000);
    storeSession({ ...STORED_SESSION, auth_employee_id: "emp-1", auth_expires_at: expiresAt });
    expect(useAuthStore.getState().hydrate()).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    vi.setSystemTime("2026-06-15T13:00:01Z");
    expect(useAuthStore.getState().hydrate()).toBe(false);
    expect(sessionKeys()).toEqual([]);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState()).toMatchObject(SIGNED_OUT);
  });

  it("signs the store out when this tab's token is gone, leaving the storage alone", () => {
    storeSession(STORED_SESSION);
    expect(useAuthStore.getState().hydrate()).toBe(true);
    sessionStorage.removeItem("token");
    localStorage.setItem("form-drafts", '{"state":{"drafts":{}},"version":0}');

    expect(useAuthStore.getState().hydrate()).toBe(false);
    expect(useAuthStore.getState()).toMatchObject(SIGNED_OUT);
    expect(sessionStorage.getItem("auth_user")).toBe("Test User");
    expect(localStorage.getItem("form-drafts")).not.toBeNull();
  });
});

describe("refreshAuth", () => {
  it("reloads the profile but keeps the token and expiry", async () => {
    storeSession({ ...STORED_SESSION, auth_expires_at: "1893456000" });
    useAuthStore.getState().hydrate();
    const fetchMock = stubFetch(
      jsonResponse({
        Success: true,
        Data: { user: "Test User", role: "admin", scopes: ["rooms:read"], userId: "user-1" },
      }),
    );

    await useAuthStore.getState().refreshAuth();

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/auth/me`);
    expect(sessionStorage.getItem("auth_role")).toBe("admin");
    expect(sessionStorage.getItem("auth_scopes")).toBe('["rooms:read"]');
    expect(sessionStorage.getItem("token")).toBe("tok-123");
    expect(sessionStorage.getItem("auth_expires_at")).toBe("1893456000");
    expect(useAuthStore.getState()).toMatchObject({ role: "admin", scopes: ["rooms:read"], token: "tok-123" });
  });
});

describe("session key lists", () => {
  it("login writes, logout removes and a 401 removes the same seven keys", async () => {
    const extra = { auth_redirect: "/rooms", unrelated: "keep" };
    vi.stubGlobal("location", { href: "http://localhost:3000/rooms" });

    stubFetch(jsonResponse({ Success: true, Data: LOGIN }));
    await useAuthStore.getState().login("test.user", "secret");
    const written = sessionKeys();

    storeSession(extra);
    useAuthStore.getState().logout();
    const afterLogout = sessionKeys();

    stubFetch(jsonResponse({ Success: true, Data: LOGIN }), jsonResponse({}, 401));
    await useAuthStore.getState().login("test.user", "secret");
    await expect(api.get("/rooms")).rejects.toThrow("Session expired");
    const afterUnauthorized = sessionKeys();

    expect(written).toEqual(SESSION_KEYS);
    expect(afterLogout).toEqual(Object.keys(extra).sort());
    expect(afterUnauthorized).toEqual(Object.keys(extra).sort());
  });
});
