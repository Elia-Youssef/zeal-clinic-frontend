// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getClinicTimezone } from "@/lib/tz";

describe("getClinicTimezone with DOM", () => {
  it("defaults to Asia/Beirut when meta tag is absent", () => {
    const existing = document.querySelector('meta[name="clinic-timezone"]');
    existing?.remove();
    expect(getClinicTimezone()).toBe("Asia/Beirut");
  });

  it("reads timezone from meta tag when present", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "clinic-timezone");
    meta.setAttribute("content", "America/New_York");
    document.head.appendChild(meta);
    try {
      expect(getClinicTimezone()).toBe("America/New_York");
    } finally {
      meta.remove();
    }
  });
});
