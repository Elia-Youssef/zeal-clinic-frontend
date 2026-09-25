import { format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BEIRUT_TZ,
  beirutDayKey,
  beirutDaysAgo,
  beirutNow,
  beirutToday,
  beirutZoned,
  dateRangeToUtc,
  formatInBeirut,
  getBeirutWallClockIssue,
  wallClockToUtc,
} from "@/lib/tz";
import {
  BEIRUT_DST_VECTORS,
  FOLD_VECTORS,
  GAP_VECTORS,
  beirutDayStartMs,
  expectVectorHolds,
  shiftDay,
} from "./helpers/time";

const NONEXISTENT =
  "The selected Beirut time does not exist because of a daylight-saving transition.";
const AMBIGUOUS =
  "The selected Beirut time occurs twice because of a daylight-saving transition.";

const iso = (ms: number) => new Date(ms).toISOString();

afterEach(() => {
  vi.useRealTimers();
});

describe("DST vectors", () => {
  it.each(BEIRUT_DST_VECTORS)("$day has $hours hours in this runtime", (vector) => {
    expectVectorHolds(vector);
  });
});

describe("BEIRUT_TZ", () => {
  it("is the IANA zone name", () => {
    expect(BEIRUT_TZ).toBe("Asia/Beirut");
  });
});

describe("getBeirutWallClockIssue", () => {
  it("accepts ordinary wall-clock values with or without seconds", () => {
    expect(getBeirutWallClockIssue("2026-04-10T14:30")).toBeNull();
    expect(getBeirutWallClockIssue("2026-04-10T14:30:45")).toBeNull();
    expect(getBeirutWallClockIssue("2026-01-10T00:00")).toBeNull();
  });

  it("reports malformed or impossible values as nonexistent", () => {
    for (const value of [
      "",
      "2026-04-10",
      "2026-04-10 14:30",
      "2026-04-10T14:30:00.000",
      "2026-04-10T14:30:00Z",
      "2026-02-30T10:00",
      "2026-04-10T24:00",
      "2026-04-10T14:60",
    ]) {
      expect(getBeirutWallClockIssue(value), value).toBe("nonexistent");
    }
  });

  it.each(GAP_VECTORS)("flags only the skipped hour of $day", (vector) => {
    expectVectorHolds(vector);
    expect(getBeirutWallClockIssue(`${shiftDay(vector.day, -1)}T23:59`)).toBeNull();
    for (const time of ["00:00", "00:01", "00:30", "00:59", "00:30:15"]) {
      expect(getBeirutWallClockIssue(`${vector.day}T${time}`), time).toBe(
        "nonexistent",
      );
    }
    expect(getBeirutWallClockIssue(`${vector.day}T01:00`)).toBeNull();
  });

  it.each(FOLD_VECTORS)("flags only the repeated hour of $day", (vector) => {
    expectVectorHolds(vector);
    expect(getBeirutWallClockIssue(`${vector.day}T22:59`)).toBeNull();
    for (const time of ["23:00", "23:30", "23:59", "23:59:59"]) {
      expect(getBeirutWallClockIssue(`${vector.day}T${time}`), time).toBe(
        "ambiguous",
      );
    }
    expect(getBeirutWallClockIssue(`${shiftDay(vector.day, 1)}T00:00`)).toBeNull();
  });
});

describe("wallClockToUtc", () => {
  it("returns an empty value unchanged", () => {
    expect(wallClockToUtc("")).toBe("");
  });

  it("applies the offset in force on that date", () => {
    expect(wallClockToUtc("2026-04-10T14:30")).toBe("2026-04-10T11:30:00.000Z");
    expect(wallClockToUtc("2026-01-10T14:30")).toBe("2026-01-10T12:30:00.000Z");
    expect(wallClockToUtc("2026-04-10T14:30:45")).toBe("2026-04-10T11:30:45.000Z");
  });

  it("rejects a malformed value with the nonexistent-time message", () => {
    expect(() => wallClockToUtc("2026-04-10 14:30")).toThrow(NONEXISTENT);
  });

  it.each(GAP_VECTORS)("throws inside the skipped hour of $day and converts its edges", (vector) => {
    expectVectorHolds(vector);
    const at = Date.parse(vector.switchAt);
    expect(() => wallClockToUtc(`${vector.day}T00:00`)).toThrow(NONEXISTENT);
    expect(() => wallClockToUtc(`${vector.day}T00:30`)).toThrow(NONEXISTENT);
    expect(wallClockToUtc(`${shiftDay(vector.day, -1)}T23:59`)).toBe(iso(at - 60_000));
    expect(wallClockToUtc(`${vector.day}T01:00`)).toBe(vector.switchAt);
  });

  it.each(FOLD_VECTORS)("throws inside the repeated hour of $day and converts its edges", (vector) => {
    expectVectorHolds(vector);
    const at = Date.parse(vector.switchAt);
    expect(() => wallClockToUtc(`${vector.day}T23:00`)).toThrow(AMBIGUOUS);
    expect(() => wallClockToUtc(`${vector.day}T23:59`)).toThrow(AMBIGUOUS);
    // 22:59 is still summer time (UTC+3); the next midnight is winter time (UTC+2).
    expect(wallClockToUtc(`${vector.day}T22:59`)).toBe(iso(at - 61 * 60_000));
    expect(wallClockToUtc(`${shiftDay(vector.day, 1)}T00:00`)).toBe(iso(at + 60 * 60_000));
  });
});

describe("dateRangeToUtc", () => {
  it("turns inclusive days into a half-open UTC range", () => {
    expect(dateRangeToUtc("2026-06-01", "2026-06-30")).toEqual({
      from: "2026-05-31T21:00:00.000Z",
      to: "2026-06-30T21:00:00.000Z",
    });
    expect(dateRangeToUtc("2026-01-01", "2026-01-31")).toEqual({
      from: "2025-12-31T22:00:00.000Z",
      to: "2026-01-31T22:00:00.000Z",
    });
  });

  it("covers exactly one day when both ends are the same day", () => {
    expect(dateRangeToUtc("2026-06-15", "2026-06-15")).toEqual({
      from: "2026-06-14T21:00:00.000Z",
      to: "2026-06-15T21:00:00.000Z",
    });
  });

  it("rolls the upper bound over month, year and leap-day ends", () => {
    expect(dateRangeToUtc("2026-12-01", "2026-12-31").to).toBe("2026-12-31T22:00:00.000Z");
    expect(dateRangeToUtc("2028-02-01", "2028-02-28").to).toBe("2028-02-28T22:00:00.000Z");
    expect(dateRangeToUtc("2028-02-01", "2028-02-29").to).toBe("2028-02-29T22:00:00.000Z");
  });

  it.each(BEIRUT_DST_VECTORS)("gives $day its real length of $hours hours", (vector) => {
    expectVectorHolds(vector);
    const { from, to } = dateRangeToUtc(vector.day, vector.day);
    expect(from).toBe(iso(beirutDayStartMs(vector.day)));
    expect(to).toBe(iso(beirutDayStartMs(shiftDay(vector.day, 1))));
    expect((Date.parse(to) - Date.parse(from)) / 3_600_000).toBe(vector.hours);
  });

  it("starts a spring-forward day at 01:00, its first existing minute", () => {
    expectVectorHolds(GAP_VECTORS[0]);
    expect(dateRangeToUtc("2026-03-29", "2026-03-29").from).toBe("2026-03-28T22:00:00.000Z");
  });

  it("neither validates nor reorders a reversed range", () => {
    expect(dateRangeToUtc("2026-06-10", "2026-06-01")).toEqual({
      from: "2026-06-09T21:00:00.000Z",
      to: "2026-06-01T21:00:00.000Z",
    });
  });

  it("throws on an upper day that is not yyyy-MM-dd", () => {
    expect(() => dateRangeToUtc("2026-06-01", "2026/06/30")).toThrow(
      "Invalid calendar day 2026/06/30.",
    );
  });
});

describe("formatInBeirut", () => {
  it("returns an empty string for missing values", () => {
    expect(formatInBeirut(null)).toBe("");
    expect(formatInBeirut(undefined)).toBe("");
    expect(formatInBeirut("")).toBe("");
  });

  it("formats instants as Beirut wall clock", () => {
    expect(formatInBeirut("2026-06-15T12:00:00Z")).toBe("2026-06-15 15:00");
    expect(formatInBeirut("2026-01-15T12:00:00Z")).toBe("2026-01-15 14:00");
    expect(formatInBeirut(new Date(Date.UTC(2026, 5, 15, 21, 30)))).toBe("2026-06-16 00:30");
    expect(formatInBeirut("2026-06-15T12:00:00Z", "HH:mm")).toBe("15:00");
    expect(formatInBeirut("2026-06-16T01:00:00+03:00")).toBe("2026-06-16 01:00");
  });

  it.each(FOLD_VECTORS)("prints both passes through the repeated hour of $day as 23:30", (vector) => {
    expectVectorHolds(vector);
    const at = Date.parse(vector.switchAt);
    const first = new Date(at - 30 * 60_000);
    const second = new Date(at + 30 * 60_000);
    expect(formatInBeirut(first)).toBe(`${vector.day} 23:30`);
    expect(formatInBeirut(second)).toBe(`${vector.day} 23:30`);
    expect(formatInBeirut(first, "HH:mm XXX")).toBe("23:30 +03:00");
    expect(formatInBeirut(second, "HH:mm XXX")).toBe("23:30 +02:00");
  });

  it("throws on a value that is not a date", () => {
    expect(() => formatInBeirut("not a date")).toThrow(RangeError);
  });
});

describe("beirutDayKey", () => {
  it("returns an empty string for missing values", () => {
    expect(beirutDayKey(null)).toBe("");
    expect(beirutDayKey(undefined)).toBe("");
    expect(beirutDayKey("")).toBe("");
  });

  it("keys by the Beirut day, not the UTC day", () => {
    // Summer: the Beirut day turns over at 21:00 UTC; winter: at 22:00 UTC.
    expect(beirutDayKey("2026-06-15T20:59:59Z")).toBe("2026-06-15");
    expect(beirutDayKey("2026-06-15T21:00:00Z")).toBe("2026-06-16");
    expect(beirutDayKey("2026-01-15T21:59:59Z")).toBe("2026-01-15");
    expect(beirutDayKey("2026-01-15T22:00:00Z")).toBe("2026-01-16");
    // UTC midnight is not a Beirut day boundary.
    expect(beirutDayKey("2026-06-15T23:59:59Z")).toBe("2026-06-16");
    expect(beirutDayKey("2026-06-16T00:00:00Z")).toBe("2026-06-16");
  });

  it.each(BEIRUT_DST_VECTORS)("keys every instant of $day to that day", (vector) => {
    expectVectorHolds(vector);
    const start = beirutDayStartMs(vector.day);
    const end = beirutDayStartMs(shiftDay(vector.day, 1));
    expect(beirutDayKey(new Date(start - 1))).toBe(shiftDay(vector.day, -1));
    expect(beirutDayKey(new Date(start))).toBe(vector.day);
    expect(beirutDayKey(new Date(end - 1))).toBe(vector.day);
    expect(beirutDayKey(new Date(end))).toBe(shiftDay(vector.day, 1));
  });
});

describe("beirutZoned", () => {
  it("puts the Beirut wall clock of an instant into local date fields", () => {
    const zoned = beirutZoned("2026-06-15T21:30:00Z");
    expect(format(zoned, "yyyy-MM-dd HH:mm")).toBe("2026-06-16 00:30");
  });
});

// [UTC now, Beirut day]: around Beirut midnight, UTC midnight and both clock changes.
const CLOCK_CASES = [
  ["2026-06-15T20:59:59.000Z", "2026-06-15"],
  ["2026-06-15T21:00:00.000Z", "2026-06-16"],
  ["2026-06-15T23:59:59.000Z", "2026-06-16"],
  ["2026-06-16T00:00:00.000Z", "2026-06-16"],
  ["2026-01-15T21:59:59.000Z", "2026-01-15"],
  ["2026-01-15T22:00:00.000Z", "2026-01-16"],
  ["2026-01-15T23:59:59.000Z", "2026-01-16"],
  ["2026-01-16T00:00:00.000Z", "2026-01-16"],
  ["2026-03-28T21:59:59.000Z", "2026-03-28"],
  ["2026-03-28T22:00:00.000Z", "2026-03-29"],
  ["2026-10-24T21:59:59.000Z", "2026-10-24"],
  ["2026-10-24T22:00:00.000Z", "2026-10-25"],
] as const;

describe("clock-based helpers", () => {
  it.each(CLOCK_CASES)("beirutToday at %s is %s", (now, day) => {
    vi.setSystemTime(now);
    expect(beirutToday()).toBe(day);
  });

  it.each(CLOCK_CASES)("beirutDaysAgo counts from the Beirut day at %s", (now, day) => {
    vi.setSystemTime(now);
    expect(beirutDaysAgo(0)).toBe(day);
    expect(beirutDaysAgo(1)).toBe(shiftDay(day, -1));
    expect(beirutDaysAgo(30)).toBe(shiftDay(day, -30));
    expect(beirutDaysAgo(-1)).toBe(shiftDay(day, 1));
  });

  it.each(CLOCK_CASES)("beirutNow holds the Beirut wall clock at %s", (now, day) => {
    vi.setSystemTime(now);
    const zoned = beirutNow();
    expect(format(zoned, "yyyy-MM-dd HH:mm:ss")).toBe(
      formatInBeirut(now, "yyyy-MM-dd HH:mm:ss"),
    );
    expect(format(zoned, "yyyy-MM-dd")).toBe(day);
  });

  it("beirutNow is shifted from the real instant unless the machine is on Beirut time", () => {
    const now = "2026-06-15T12:00:00.000Z";
    vi.setSystemTime(now);
    const machineOffset = -new Date(now).getTimezoneOffset();
    const shiftMinutes = (Date.parse(now) - beirutNow().getTime()) / 60_000;
    expect(shiftMinutes).toBe(machineOffset - 180);
  });
});
