// @vitest-environment jsdom
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, BASE_URL, toISODate, toISODateTime } from "@/lib/api";
import { useFormDraftsStore } from "@/lib/stores/form-drafts-store";
import { useLoadingStore } from "@/lib/stores/loading-store";

const SESSION_KEYS = [
  "token",
  "auth_user",
  "auth_role",
  "auth_scopes",
  "auth_user_id",
  "auth_employee_id",
  "auth_expires_at",
];

const FORBIDDEN = "You don't have permission to do that.";

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

function stubLocation() {
  const location = { href: "http://localhost:3000/patients" };
  vi.stubGlobal("location", location);
  return location;
}

function seedSession() {
  for (const key of SESSION_KEYS) sessionStorage.setItem(key, `${key}-value`);
  sessionStorage.setItem("auth_redirect", "/patients");
  useFormDraftsStore.getState().saveDraft("patient", {
    id: "draft-1",
    label: "Test Patient",
    data: { name: "Test Patient" },
  });
  localStorage.setItem("ui-settings", '{"state":{"theme":"light"},"version":0}');
}

beforeEach(() => {
  useFormDraftsStore.setState({ drafts: {} });
  useLoadingStore.getState().reset();
  sessionStorage.clear();
  localStorage.clear();
});

describe("BASE_URL", () => {
  it("points at the local API server in development", () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(BASE_URL).toBe("http://localhost:55555/api");
  });

  it("uses the page's own origin in a production build", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const fresh = await import("@/lib/api");
    expect(fresh.BASE_URL).toBe(`${window.location.origin}/api`);
  });

  it.each([
    ["", "http://localhost:55555"],
    ["  ", "http://localhost:55555"],
    ["http://clinic.lan:8080", "http://clinic.lan:8080"],
    ["http://clinic.lan:8080/", "http://clinic.lan:8080"],
    ["http://clinic.lan:8080///", "http://clinic.lan:8080"],
    ["http://clinic.lan:8080/api", "http://clinic.lan:8080"],
    ["http://clinic.lan:8080/api/", "http://clinic.lan:8080"],
    ["  http://clinic.lan:8080/api/  ", "http://clinic.lan:8080"],
  ])("cleans up a configured origin %j", async (configured, expected) => {
    vi.stubEnv("VITE_API_BASE_URL", configured);
    vi.resetModules();
    const fresh = await import("@/lib/api");
    expect(fresh.BASE_URL).toBe(`${expected}/api`);
  });
});

describe("requests", () => {
  it("sends JSON with the session's bearer token", async () => {
    sessionStorage.setItem("token", "tok-123");
    const fetchMock = stubFetch(jsonResponse({ Success: true, Data: { id: "p1" } }));

    await expect(api.post("/patients", { name: "Test Patient" })).resolves.toEqual({ id: "p1" });

    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/patients`, {
      method: "POST",
      body: '{"name":"Test Patient"}',
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok-123" },
    });
  });

  it("omits the Authorization header without a token", async () => {
    const fetchMock = stubFetch(jsonResponse({ Success: true, Data: [] }));
    await api.get("/rooms");
    expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/rooms`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("uses the matching method for each helper and drops empty bodies", async () => {
    const fetchMock = stubFetch(
      jsonResponse({ Success: true, Data: 1 }),
      jsonResponse({ Success: true, Data: 2 }),
      jsonResponse({ Success: true, Data: 3 }),
      jsonResponse({ Success: true, Data: 4 }),
    );
    await api.put("/rooms/1", { name: "Room A" });
    await api.patch("/rooms/1", undefined);
    await api.del("/rooms/1");
    await api.post("/rooms/1/restore");
    const sent = fetchMock.mock.calls.map(([, init]) => [init?.method, init?.body]);
    expect(sent).toEqual([
      ["PUT", '{"name":"Room A"}'],
      ["PATCH", undefined],
      ["DELETE", undefined],
      ["POST", undefined],
    ]);
  });
});

describe("response envelope", () => {
  it("returns Data, or data when Data is missing", async () => {
    stubFetch(
      jsonResponse({ Success: true, Data: { items: [], total: 0 } }),
      jsonResponse({ success: true, data: 7 }),
      jsonResponse({ Success: true, Data: null }),
    );
    await expect(api.get("/patients")).resolves.toEqual({ items: [], total: 0 });
    await expect(api.get("/count")).resolves.toBe(7);
    await expect(api.get("/empty")).resolves.toBeUndefined();
  });

  it("throws the server's error message", async () => {
    stubFetch(
      jsonResponse({ Success: false, Error: "Please check your input" }, 400),
      jsonResponse({ Success: false, Error: "Room is busy" }, 200),
      jsonResponse({ success: false, error: "lowercase error" }, 409),
    );
    await expect(api.post("/rooms", {})).rejects.toThrow("Please check your input");
    await expect(api.post("/rooms", {})).rejects.toThrow("Room is busy");
    await expect(api.post("/rooms", {})).rejects.toThrow("lowercase error");
  });

  it("falls back to a generic message", async () => {
    stubFetch(jsonResponse({}, 500), jsonResponse({ Success: false }, 200));
    await expect(api.get("/rooms")).rejects.toThrow("Something went wrong");
    await expect(api.get("/rooms")).rejects.toThrow("Something went wrong");
  });

  it("rejects with the JSON parse error for a body that is not JSON", async () => {
    stubFetch(
      new Response("<html>Bad Gateway</html>", { status: 502 }),
      new Response(null, { status: 204 }),
    );
    await expect(api.get("/rooms")).rejects.toBeInstanceOf(SyntaxError);
    await expect(api.del("/rooms/1")).rejects.toBeInstanceOf(SyntaxError);
  });

  it("does not wrap network failures", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.get("/rooms")).rejects.toThrow(TypeError);
  });
});

describe("401 Unauthorized", () => {
  it("clears the session and the drafts, then sends the browser to /", async () => {
    seedSession();
    const location = stubLocation();
    stubFetch(jsonResponse({ Success: false, Error: "Unauthorized" }, 401));

    await expect(api.get("/patients")).rejects.toThrow("Session expired");

    for (const key of SESSION_KEYS) expect(sessionStorage.getItem(key), key).toBeNull();
    expect(useFormDraftsStore.getState().drafts).toEqual({});
    expect(localStorage.getItem("form-drafts")).toBeNull();
    expect(location.href).toBe("/");
    expect(useLoadingStore.getState()).toMatchObject({ count: 1, message: "Session expired" });
    // Other keys stay.
    expect(sessionStorage.getItem("auth_redirect")).toBe("/patients");
    expect(localStorage.getItem("ui-settings")).not.toBeNull();
  });
});

describe("403 Forbidden", () => {
  it("toasts one permission error and keeps the session", async () => {
    seedSession();
    const location = stubLocation();
    const error = vi.spyOn(toast, "error");
    stubFetch(
      jsonResponse({ Success: false }, 403),
      jsonResponse({ Success: false }, 403),
      jsonResponse({ Success: false }, 403),
    );

    for (let i = 0; i < 3; i++) {
      await expect(api.get("/reports")).rejects.toThrow("Access denied");
    }

    expect(error).toHaveBeenCalledTimes(3);
    for (const call of error.mock.calls) {
      expect(call).toEqual([FORBIDDEN, { id: "forbidden" }]);
    }
    // The shared toast id collapses the burst into a single toast.
    expect(toast.getHistory().filter((t) => t.id === "forbidden")).toHaveLength(1);
    expect(sessionStorage.getItem("token")).toBe("token-value");
    expect(location.href).toBe("http://localhost:3000/patients");
  });

  it("stays quiet for silent requests", async () => {
    const error = vi.spyOn(toast, "error");
    stubFetch(jsonResponse({ Success: false }, 403));
    await expect(api.get("/reports", { silent: true })).rejects.toThrow("Access denied");
    expect(error).not.toHaveBeenCalled();
  });
});

describe("toISODate", () => {
  it("keeps the date part as written", () => {
    expect(toISODate("")).toBe("");
    expect(toISODate("2026-06-15")).toBe("2026-06-15");
    expect(toISODate("2026-06-15T10:00")).toBe("2026-06-15");
    // Not converted to the Beirut day (which is June 16 here).
    expect(toISODate("2026-06-15T23:30:00Z")).toBe("2026-06-15");
  });
});

describe("toISODateTime", () => {
  it("converts Beirut picker values to UTC", () => {
    expect(toISODateTime("")).toBe("");
    expect(toISODateTime("2026-04-10T14:30")).toBe("2026-04-10T11:30:00.000Z");
    expect(toISODateTime("2026-01-10T14:30:15")).toBe("2026-01-10T12:30:15.000Z");
  });

  it("normalizes values that carry an offset", () => {
    expect(toISODateTime("2026-04-10T14:30:00Z")).toBe("2026-04-10T14:30:00.000Z");
    expect(toISODateTime("2026-04-10T14:30:00+03:00")).toBe("2026-04-10T11:30:00.000Z");
    expect(toISODateTime("2026-04-10T14:30-05:00")).toBe("2026-04-10T19:30:00.000Z");
  });

  it("throws on invalid values", () => {
    expect(() => toISODateTime("2026-13-45T10:00:00+03:00")).toThrow("Invalid date and time.");
    expect(() => toISODateTime("2026-03-29T00:30")).toThrow("does not exist");
    expect(() => toISODateTime("2026-10-24T23:30")).toThrow("occurs twice");
  });
});
