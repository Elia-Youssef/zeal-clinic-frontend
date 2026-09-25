import { describe, expect, it } from "vitest";
import {
  formatHours,
  groupScheduleVersions,
  timeToDecimal,
  validateShifts,
  versionInForce,
  type EmployeeScheduleVersion,
} from "@/components/shared/employee-schedule-utils";
import type { EmployeeSchedule } from "@/lib/types";

function shift(
  id: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  extra: Partial<EmployeeSchedule> = {},
): EmployeeSchedule {
  return {
    id,
    employeeId: "emp-1",
    dayOfWeek,
    startTime,
    endTime,
    isActive: true,
    ...extra,
  };
}

function version(
  dayOfWeek: number,
  startDate: string,
  endDate?: string,
): EmployeeScheduleVersion {
  return { dayOfWeek, startDate, endDate, isActive: !endDate, shifts: [] };
}

describe("timeToDecimal", () => {
  it("converts HH:mm to decimal hours", () => {
    expect(timeToDecimal("00:00")).toBe(0);
    expect(timeToDecimal("09:30")).toBe(9.5);
    expect(timeToDecimal("23:45")).toBe(23.75);
  });
});

describe("formatHours", () => {
  it("prints whole hours bare and others with one decimal", () => {
    expect(formatHours(8)).toBe("8");
    expect(formatHours(0)).toBe("0");
    expect(formatHours(7.5)).toBe("7.5");
    expect(formatHours(7.25)).toBe("7.3");
    expect(formatHours(7.75)).toBe("7.8");
    expect(formatHours(2 / 3)).toBe("0.7");
  });

  it("drops a trailing .0 after rounding", () => {
    expect(formatHours(7.04)).toBe("7");
    expect(formatHours(8.96)).toBe("9");
  });
});

describe("groupScheduleVersions", () => {
  it("groups rows by weekday and start date and sorts each version's shifts", () => {
    const versions = groupScheduleVersions([
      shift("a", 1, "14:00", "18:00", { startDate: "2026-08-01T00:00:00Z" }),
      shift("b", 1, "09:00", "13:00", { startDate: "2026-08-01" }),
      shift("c", 2, "09:00", "17:00", {
        startDate: "2026-01-01",
        endDate: "2026-08-01T00:00:00Z",
        isActive: false,
      }),
      shift("d", 1, "10:00", "16:00", {
        startDate: "2026-01-01",
        endDate: "2026-08-01",
        isActive: false,
      }),
    ]);

    expect(versions.map((v) => [v.dayOfWeek, v.startDate, v.endDate, v.isActive])).toEqual([
      [1, "2026-08-01", undefined, true],
      [2, "2026-01-01", "2026-08-01", false],
      [1, "2026-01-01", "2026-08-01", false],
    ]);
    expect(versions[0].shifts.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("takes the end date and active flag from the first row of a version", () => {
    const [only] = groupScheduleVersions([
      shift("a", 3, "09:00", "12:00", { startDate: "2026-02-01", endDate: "" }),
      shift("b", 3, "13:00", "17:00", {
        startDate: "2026-02-01",
        endDate: "2026-09-01",
        isActive: false,
      }),
    ]);
    expect(only.endDate).toBeUndefined();
    expect(only.isActive).toBe(true);
    expect(only.shifts).toHaveLength(2);
  });

  it("keys rows without a start date under an empty date", () => {
    const [only] = groupScheduleVersions([shift("a", 0, "09:00", "12:00")]);
    expect(only.startDate).toBe("");
  });
});

describe("versionInForce", () => {
  const versions = [
    version(1, "2026-01-01", "2026-08-10"),
    version(1, "2026-08-10"),
    version(1, "2026-09-01"),
    version(2, "2026-01-01"),
  ];

  it("picks the latest version that started on or before the date", () => {
    expect(versionInForce(versions, 1, "2026-05-01")?.startDate).toBe("2026-01-01");
    expect(versionInForce(versions, 1, "2026-08-20")?.startDate).toBe("2026-08-10");
    expect(versionInForce(versions, 1, "2026-09-01")?.startDate).toBe("2026-09-01");
    expect(versionInForce(versions, 1, "2027-01-01")?.startDate).toBe("2026-09-01");
  });

  it("treats the end date as exclusive", () => {
    expect(versionInForce(versions, 1, "2026-08-09")?.startDate).toBe("2026-01-01");
    expect(versionInForce(versions, 1, "2026-08-10")?.startDate).toBe("2026-08-10");
    expect(versionInForce([version(4, "2026-01-01", "2026-03-01")], 4, "2026-03-01")).toBeUndefined();
  });

  it("finds nothing before the first version or on another weekday", () => {
    expect(versionInForce(versions, 1, "2025-12-31")).toBeUndefined();
    expect(versionInForce(versions, 5, "2026-05-01")).toBeUndefined();
    expect(versionInForce(versions, 2, "2026-05-01")?.dayOfWeek).toBe(2);
  });
});

describe("validateShifts", () => {
  it("accepts no shifts, one shift and touching shifts", () => {
    expect(validateShifts([])).toBeNull();
    expect(validateShifts([{ startTime: "09:00", endTime: "17:00" }])).toBeNull();
    expect(
      validateShifts([
        { startTime: "09:00", endTime: "13:00" },
        { startTime: "13:00", endTime: "18:00" },
      ]),
    ).toBeNull();
  });

  it("needs both times as HH:mm", () => {
    expect(validateShifts([{ startTime: "", endTime: "17:00" }])).toBe(
      "Shift 1 needs both a start and an end time.",
    );
    expect(validateShifts([{ startTime: "9:00", endTime: "17:00" }])).toBe(
      "Shift 1 needs both a start and an end time.",
    );
    expect(
      validateShifts([
        { startTime: "09:00", endTime: "13:00" },
        { startTime: "14:00", endTime: "" },
      ]),
    ).toBe("Shift 2 needs both a start and an end time.");
  });

  it("rejects shifts that end at or before their start", () => {
    const message = "Shift 1 must end after it starts — a shift can't run past midnight.";
    expect(validateShifts([{ startTime: "10:00", endTime: "09:00" }])).toBe(message);
    expect(validateShifts([{ startTime: "09:00", endTime: "09:00" }])).toBe(message);
    expect(validateShifts([{ startTime: "22:00", endTime: "02:00" }])).toBe(message);
  });

  it("names the overlapping pair in start-time order", () => {
    expect(
      validateShifts([
        { startTime: "12:30", endTime: "18:00" },
        { startTime: "09:00", endTime: "13:00" },
      ]),
    ).toBe("Shifts 09:00–13:00 and 12:30–18:00 overlap.");
    expect(
      validateShifts([
        { startTime: "09:00", endTime: "18:00" },
        { startTime: "10:00", endTime: "11:00" },
      ]),
    ).toBe("Shifts 09:00–18:00 and 10:00–11:00 overlap.");
  });
});
