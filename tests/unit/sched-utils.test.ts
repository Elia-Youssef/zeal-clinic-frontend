import { afterEach, describe, expect, it, vi } from "vitest";
import { beirutNow, beirutToday, beirutZoned } from "@/lib/tz";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  GRID_HEIGHT,
  GRID_LEAD_REM,
  GRID_TOTAL_MINUTES,
  HOURS,
  HOUR_HEIGHT,
  formatGridMinutes,
  formatHour,
  formatQuarterHour,
  gridColsFor,
  gridMinutesToWallClock,
  isoToDate,
  isoToGridMinutes,
  isoToTime,
  padHour,
  timeToDecimal,
  toDateStr,
} from "@/pages/schedule/components/sched-utils";
import { RUNTIME_ZONE } from "./helpers/time";

afterEach(() => {
  vi.useRealTimers();
});

describe("grid constants", () => {
  it("spans 08:00 to 20:00 at 7.5rem per hour", () => {
    expect(DAY_START_HOUR).toBe(8);
    expect(DAY_END_HOUR).toBe(20);
    expect(HOURS).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(HOUR_HEIGHT).toBe(7.5);
    expect(GRID_HEIGHT).toBe(90);
    expect(GRID_TOTAL_MINUTES).toBe(720);
    expect(GRID_LEAD_REM).toBe(4.05);
    expect(gridColsFor(3)).toBe("3.3rem 0.75rem repeat(3, 1fr)");
  });
});

describe("conversions", () => {
  it("reads instants in Beirut time", () => {
    expect(isoToDate("2026-06-15T21:30:00Z")).toBe("2026-06-16");
    expect(isoToTime("2026-06-15T21:30:00Z")).toBe("00:30");
    expect(isoToTime("2026-01-15T06:15:00Z")).toBe("08:15");
  });

  it("labels hours and quarter hours on a 12-hour clock", () => {
    expect([0, 8, 11, 12, 13, 23].map(formatHour)).toEqual([
      "12 AM",
      "8 AM",
      "11 AM",
      "12 PM",
      "1 PM",
      "11 PM",
    ]);
    expect(formatQuarterHour(9, 5)).toBe("9:05 AM");
    expect(formatQuarterHour(12, 45)).toBe("12:45 PM");
    expect(formatQuarterHour(0, 0)).toBe("12:00 AM");
  });

  it("converts times to decimal hours", () => {
    expect(timeToDecimal("09:30")).toBe(9.5);
    expect(timeToDecimal("13:45")).toBe(13.75);
    expect(timeToDecimal("7:15")).toBe(7.25);
  });

  it("places instants in minutes from 08:00 Beirut", () => {
    expect(isoToGridMinutes("2026-06-15T05:00:00Z")).toBe(0);
    expect(isoToGridMinutes("2026-06-15T06:15:00Z")).toBe(75);
    expect(isoToGridMinutes("2026-06-15T04:00:00Z")).toBe(-60);
    expect(isoToGridMinutes("2026-06-15T17:00:00Z")).toBe(720);
    expect(isoToGridMinutes("2026-01-15T06:00:00Z")).toBe(0);
  });

  it("turns grid minutes back into wall-clock labels", () => {
    expect(gridMinutesToWallClock(0)).toBe("08:00");
    expect(gridMinutesToWallClock(75)).toBe("09:15");
    expect(gridMinutesToWallClock(720)).toBe("20:00");
    expect(gridMinutesToWallClock(-15)).toBe("07:45");
    expect(formatGridMinutes(0)).toBe("8:00 AM");
    expect(formatGridMinutes(300)).toBe("1:00 PM");
    expect(formatGridMinutes(705)).toBe("7:45 PM");
    expect(padHour(7)).toBe("07");
    expect(padHour(12)).toBe("12");
  });
});

// The clinic's day for a few instants. Before, a raw instant fed to toDateStr
// gave the machine's day instead (June 16 in Kiritimati for the first and the
// third); the calendar's dates are zoned (beirutNow, beirutZoned, the picked
// day), and read the same in every zone.
const CLINIC_DAY: Record<string, string> = {
  "2026-06-15T12:00:00Z": "2026-06-15",
  "2026-06-15T21:30:00Z": "2026-06-16",
  "2026-01-15T10:30:00Z": "2026-01-15",
};
const CHECKED_ZONES = ["Asia/Beirut", "Pacific/Kiritimati"];

describe("toDateStr (the calendar day carried in a zoned Date)", () => {
  it("prints the day held in the local fields", () => {
    expect(toDateStr(new Date(2026, 5, 15, 0, 0))).toBe("2026-06-15");
    expect(toDateStr(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it.runIf(CHECKED_ZONES.includes(RUNTIME_ZONE))(
    `gives the clinic's day of a zoned instant (${RUNTIME_ZONE})`,
    () => {
      for (const [iso, day] of Object.entries(CLINIC_DAY)) {
        expect(isoToDate(iso), iso).toBe(day);
        expect(toDateStr(beirutZoned(iso)), iso).toBe(day);
        expect(toDateStr(beirutZoned(new Date(iso))), iso).toBe(day);
      }
    },
  );

  it("gives the Beirut day when fed beirutNow(), as the calendar does", () => {
    for (const now of [
      "2026-06-15T12:00:00Z",
      "2026-06-15T20:59:59Z",
      "2026-06-15T21:00:00Z",
      "2026-06-16T00:30:00Z",
      "2026-01-15T22:30:00Z",
    ]) {
      vi.setSystemTime(now);
      expect(toDateStr(beirutNow()), now).toBe(beirutToday());
    }
  });
});
