import { describe, expect, it } from "vitest";
import { RUNTIME_ZONE } from "./helpers/time";

// The suite runs once per machine zone. These checks make sure the zone was
// really applied, so a run cannot pass on the wrong zone by accident.

const SUMMER_OFFSET: Record<string, number> = {
  "Asia/Beirut": -180,
  "Pacific/Kiritimati": -840,
};

describe("test environment", () => {
  it.runIf(Boolean(process.env.TZ))("runs in the zone named by TZ", () => {
    expect(RUNTIME_ZONE).toBe(process.env.TZ);
  });

  it.runIf(RUNTIME_ZONE in SUMMER_OFFSET)(`uses ${RUNTIME_ZONE} for local Date fields`, () => {
    expect(new Date("2026-06-15T12:00:00Z").getTimezoneOffset()).toBe(SUMMER_OFFSET[RUNTIME_ZONE]);
  });

  it("knows the clinic's zone", () => {
    const zone = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Beirut" }).resolvedOptions()
      .timeZone;
    expect(zone).toBe("Asia/Beirut");
  });
});
