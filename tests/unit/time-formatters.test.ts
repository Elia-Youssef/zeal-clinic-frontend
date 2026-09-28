import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTime, formatTimeRange, isUnder18 } from "@/lib/utils";
import {
  expectVectorHolds,
  FOLD_VECTORS,
  GAP_VECTORS,
  RUNTIME_ZONE,
} from "./helpers/time";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatTime", () => {
  it("prints --- for missing or unreadable values", () => {
    expect(formatTime(null)).toBe("---");
    expect(formatTime(undefined)).toBe("---");
    expect(formatTime("")).toBe("---");
    expect(formatTime("noon")).toBe("---");
    expect(formatTime("24:00")).toBe("---");
  });

  it("turns HH:mm into a 12-hour time", () => {
    expect(formatTime("00:15")).toBe("12:15 AM");
    expect(formatTime("09:05")).toBe("9:05 AM");
    expect(formatTime("9:05")).toBe("9:05 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("13:05:59")).toBe("1:05 PM");
  });

  it("reads full timestamps in Beirut time", () => {
    expect(formatTime("2026-06-15T21:15:00Z")).toBe("12:15 AM");
    expect(formatTime("2026-01-15T21:15:00Z")).toBe("11:15 PM");
  });
});

describe("formatTimeRange", () => {
  it("joins two times and prints --- only when both are missing", () => {
    expect(formatTimeRange("09:00", "17:30")).toBe("9:00 AM - 5:30 PM");
    expect(formatTimeRange("09:00", null)).toBe("9:00 AM - ---");
    expect(formatTimeRange(null, undefined)).toBe("---");
  });

  it("annotates ranges that end on a later Beirut day", () => {
    expect(formatTimeRange("2026-06-15T06:00:00Z", "2026-06-15T07:30:00Z")).toBe(
      "9:00 AM - 10:30 AM",
    );
    expect(formatTimeRange("2026-06-15T19:00:00Z", "2026-06-15T22:00:00Z")).toBe(
      "10:00 PM - 1:00 AM (+1 day)",
    );
    expect(formatTimeRange("2026-06-15T06:00:00Z", "2026-06-17T06:00:00Z")).toBe(
      "9:00 AM - 9:00 AM (+2 days)",
    );
  });

  it.each(GAP_VECTORS)("marks a range across the spring-forward change on $day", (vector) => {
    expectVectorHolds(vector);
    const at = Date.parse(vector.switchAt);
    const start = new Date(at - 30 * 60_000).toISOString(); // 23:30 the day before
    const end = new Date(at + 30 * 60_000).toISOString(); // 01:30
    expect(formatTimeRange(start, end)).toBe("11:30 PM - 1:30 AM (+1 day, DST adjusted)");
  });

  it.each(FOLD_VECTORS)("marks a range inside the repeated hour of $day", (vector) => {
    expectVectorHolds(vector);
    const at = Date.parse(vector.switchAt);
    const first = new Date(at - 30 * 60_000).toISOString(); // 23:30 summer time
    const second = new Date(at + 30 * 60_000).toISOString(); // 23:30 winter time
    expect(formatTimeRange(first, second)).toBe("11:30 PM - 11:30 PM (DST fold)");
  });

  it.each(FOLD_VECTORS)("marks a range across the fall-back change on $day", (vector) => {
    expectVectorHolds(vector);
    const at = Date.parse(vector.switchAt);
    const start = new Date(at - 2 * 3_600_000).toISOString(); // 22:00 summer time
    const end = new Date(at + 90 * 60_000).toISOString(); // 00:30 the next day
    expect(formatTimeRange(start, end)).toBe("10:00 PM - 12:30 AM (+1 day, DST adjusted)");
  });
});

// On 2026-06-15 at 12:00 UTC the clinic's day is June 15, so someone born on
// 2008-06-16 is still 17 there; a machine in Kiritimati is already on June 16.
// The age follows the clinic's day, whatever zone the browser is in (before,
// the Kiritimati machine counted the patient as an adult a day early).
describe("isUnder18 (reads the clinic's date)", () => {
  it("is false for missing or unreadable dates", () => {
    expect(isUnder18(null)).toBe(false);
    expect(isUnder18(undefined)).toBe(false);
    expect(isUnder18("")).toBe(false);
    expect(isUnder18("not-a-date")).toBe(false);
  });

  it("counts whole years up to the birthday", () => {
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    expect(isUnder18("2008-06-15")).toBe(false);
    expect(isUnder18("2008-06-16")).toBe(true);
    expect(isUnder18("2008-06-14T23:00:00Z")).toBe(false);
    expect(isUnder18("2010-01-01")).toBe(true);
    expect(isUnder18("1990-01-01")).toBe(false);
  });

  it.runIf(["Asia/Beirut", "Pacific/Kiritimati"].includes(RUNTIME_ZONE))(
    `uses the clinic's day, not the machine's (${RUNTIME_ZONE})`,
    () => {
      vi.setSystemTime("2026-06-15T12:00:00Z");
      expect(isUnder18("2008-06-16")).toBe(true);
      // 20:30 UTC: Kiritimati (UTC+14) is on June 16 already, the clinic still
      // on June 15, so the birthday has not come for the clinic either.
      vi.setSystemTime("2026-06-15T20:30:00Z");
      expect(isUnder18("2008-06-16")).toBe(true);
      // 21:30 UTC is already June 16 in the clinic (00:30), so the birthday has come.
      vi.setSystemTime("2026-06-15T21:30:00Z");
      expect(isUnder18("2008-06-16")).toBe(false);
    },
  );
});
