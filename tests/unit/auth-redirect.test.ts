// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { consumeAuthRedirect, storeAuthRedirect } from "@/lib/auth-redirect";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("auth redirect", () => {
  it("defaults to /dashboard when nothing was stored", () => {
    expect(consumeAuthRedirect()).toBe("/dashboard");
  });

  it("returns a stored path once, then the default", () => {
    storeAuthRedirect("/patients/123?tab=invoices#top");
    expect(sessionStorage.getItem("auth_redirect")).toBe("/patients/123?tab=invoices#top");
    expect(localStorage.length).toBe(0);
    expect(consumeAuthRedirect()).toBe("/patients/123?tab=invoices#top");
    expect(sessionStorage.getItem("auth_redirect")).toBeNull();
    expect(consumeAuthRedirect()).toBe("/dashboard");
  });

  it("keeps the latest stored path", () => {
    storeAuthRedirect("/rooms");
    storeAuthRedirect("/schedule");
    expect(consumeAuthRedirect()).toBe("/schedule");
  });

  it("ignores the root, protocol-relative, absolute and relative paths", () => {
    storeAuthRedirect("/rooms");
    for (const path of ["/", "//evil.example/rooms", "https://evil.example/", "rooms", ""]) {
      storeAuthRedirect(path);
      expect(sessionStorage.getItem("auth_redirect"), path).toBe("/rooms");
    }
  });

  it("refuses an unsafe value planted in storage and removes it", () => {
    sessionStorage.setItem("auth_redirect", "//evil.example");
    expect(consumeAuthRedirect()).toBe("/dashboard");
    expect(sessionStorage.getItem("auth_redirect")).toBeNull();

    sessionStorage.setItem("auth_redirect", "/");
    expect(consumeAuthRedirect()).toBe("/dashboard");
  });
});
