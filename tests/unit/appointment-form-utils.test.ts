import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emptyForm,
  transitionsFrom,
  TRANSITION_STATUSES,
} from "@/components/forms/appointment-form/types";
import {
  addCalendarDays,
  calendarDayDiff,
  isPastStartTime,
  mergeInitial,
  timeDiffMinutes,
} from "@/components/forms/appointment-form/utils";
import { expectVectorHolds, FOLD_VECTORS, GAP_VECTORS } from "./helpers/time";

afterEach(() => {
  vi.useRealTimers();
});

describe("timeDiffMinutes", () => {
  it("measures Beirut wall-clock ranges in real minutes", () => {
    expect(timeDiffMinutes("2026-06-15", "09:00", "2026-06-15", "10:30")).toBe(90);
    expect(timeDiffMinutes("2026-06-15", "23:00", "2026-06-16", "01:00")).toBe(120);
    expect(timeDiffMinutes("2026-06-15", "10:00", "2026-06-15", "09:00")).toBe(-60);
  });

  it("returns NaN when a field is missing", () => {
    expect(timeDiffMinutes("", "09:00", "2026-06-15", "10:00")).toBeNaN();
    expect(timeDiffMinutes("2026-06-15", "", "2026-06-15", "10:00")).toBeNaN();
    expect(timeDiffMinutes("2026-06-15", "09:00", "", "10:00")).toBeNaN();
    expect(timeDiffMinutes("2026-06-15", "09:00", "2026-06-15", "")).toBeNaN();
  });

  it("counts the real length across the spring-forward change", () => {
    expectVectorHolds(GAP_VECTORS[0]);
    // 23:30 to 01:30 on the wall is one real hour.
    expect(timeDiffMinutes("2026-03-28", "23:30", "2026-03-29", "01:30")).toBe(60);
    expect(timeDiffMinutes("2026-03-29", "00:30", "2026-03-29", "02:00")).toBeNaN();
  });

  it("counts the real length across the fall-back change", () => {
    expectVectorHolds(FOLD_VECTORS[0]);
    // 22:00 to 00:30 on the wall is three and a half real hours.
    expect(timeDiffMinutes("2026-10-24", "22:00", "2026-10-25", "00:30")).toBe(210);
    expect(timeDiffMinutes("2026-10-24", "23:30", "2026-10-25", "00:30")).toBeNaN();
  });

  it("prefers preserved UTC instants, which settle the repeated hour", () => {
    expectVectorHolds(FOLD_VECTORS[0]);
    const range = ["2026-10-24", "23:30", "2026-10-25", "00:30"] as const;
    expect(timeDiffMinutes(...range, "2026-10-24T20:30:00Z")).toBe(120);
    expect(timeDiffMinutes(...range, "2026-10-24T21:30:00Z")).toBe(60);
    expect(
      timeDiffMinutes("2026-06-15", "09:00", "2026-06-15", "10:00", "not a date"),
    ).toBe(60);
  });
});

describe("calendarDayDiff", () => {
  it("counts calendar days, unaffected by clock changes", () => {
    expect(calendarDayDiff("2026-06-15", "2026-06-15")).toBe(0);
    expect(calendarDayDiff("2026-06-15", "2026-06-16")).toBe(1);
    expect(calendarDayDiff("2026-06-16", "2026-06-15")).toBe(-1);
    expect(calendarDayDiff("2026-03-28", "2026-03-30")).toBe(2);
    expect(calendarDayDiff("2026-10-24", "2026-10-26")).toBe(2);
    expect(calendarDayDiff("2026-01-31", "2026-03-01")).toBe(29);
  });

  it("returns 0 for values it cannot parse", () => {
    expect(calendarDayDiff("", "2026-06-15")).toBe(0);
    expect(calendarDayDiff("2026-06-15", "soon")).toBe(0);
  });
});

describe("addCalendarDays", () => {
  it("adds days across month, year, leap-day and clock-change boundaries", () => {
    expect(addCalendarDays("2026-06-15", 1)).toBe("2026-06-16");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addCalendarDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addCalendarDays("2026-10-24", 1)).toBe("2026-10-25");
  });

  it("returns anything but yyyy-MM-dd unchanged", () => {
    expect(addCalendarDays("2026-6-1", 1)).toBe("2026-6-1");
    expect(addCalendarDays("2026-06-15T10:00", 1)).toBe("2026-06-15T10:00");
    expect(addCalendarDays("", 1)).toBe("");
  });
});

describe("transitionsFrom", () => {
  it("offers every other status", () => {
    expect(TRANSITION_STATUSES).toEqual(["Scheduled", "In-Progress", "Completed", "Cancelled"]);
    expect(transitionsFrom("Scheduled")).toEqual(["In-Progress", "Completed", "Cancelled"]);
    expect(transitionsFrom("In-Progress")).toEqual(["Scheduled", "Completed", "Cancelled"]);
    expect(transitionsFrom("Completed")).toEqual(["Scheduled", "In-Progress", "Cancelled"]);
    expect(transitionsFrom("Cancelled")).toEqual(["Scheduled", "In-Progress", "Completed"]);
  });

  it("never offers Scheduled for a rescheduled or unknown status", () => {
    expect(transitionsFrom("Rescheduled")).toEqual(["In-Progress", "Completed", "Cancelled"]);
    expect(transitionsFrom("Unknown")).toEqual(["In-Progress", "Completed", "Cancelled"]);
  });
});

describe("isPastStartTime", () => {
  it("compares the Beirut start with the current instant", () => {
    vi.setSystemTime("2026-06-15T09:00:00Z"); // 12:00 in Beirut
    expect(isPastStartTime("2026-06-15", "11:59")).toBe(true);
    expect(isPastStartTime("2026-06-15", "12:00")).toBe(false);
    expect(isPastStartTime("2026-06-15", "12:01")).toBe(false);
  });

  it("uses the Beirut day around Beirut midnight", () => {
    vi.setSystemTime("2026-06-15T21:30:00Z"); // 00:30 on June 16 in Beirut
    expect(isPastStartTime("2026-06-15", "23:59")).toBe(true);
    expect(isPastStartTime("2026-06-16", "00:15")).toBe(true);
    expect(isPastStartTime("2026-06-16", "00:45")).toBe(false);
  });

  it("uses the Beirut day around UTC midnight", () => {
    vi.setSystemTime("2026-06-16T00:30:00Z"); // 03:30 on June 16 in Beirut
    expect(isPastStartTime("2026-06-16", "03:00")).toBe(true);
    expect(isPastStartTime("2026-06-16", "04:00")).toBe(false);
  });

  it("is false for missing fields and for times a clock change makes invalid", () => {
    vi.setSystemTime("2027-01-01T00:00:00Z");
    expect(isPastStartTime("", "09:00")).toBe(false);
    expect(isPastStartTime("2026-06-15", "")).toBe(false);
    expect(isPastStartTime("2026-03-29", "00:30")).toBe(false);
    expect(isPastStartTime("2026-10-24", "23:30")).toBe(false);
  });

  it("prefers a preserved UTC instant", () => {
    vi.setSystemTime("2026-06-15T09:00:00Z");
    expect(isPastStartTime("2026-06-15", "23:59", "2026-06-15T08:00:00Z")).toBe(true);
    expect(isPastStartTime("2026-06-15", "08:00", "2026-06-15T10:00:00Z")).toBe(false);
  });
});

describe("mergeInitial", () => {
  it("returns the shared empty form when there is nothing to merge", () => {
    expect(mergeInitial()).toBe(emptyForm);
  });

  it("projects API instants onto Beirut date and time fields", () => {
    const form = mergeInitial({
      startTime: "2026-06-15T21:30:00Z",
      endTime: "2026-06-15T22:30:00Z",
    });
    expect([form.date, form.startTime, form.endDate, form.endTime]).toEqual([
      "2026-06-16",
      "00:30",
      "2026-06-16",
      "01:30",
    ]);
    expect(form.status).toBe("Scheduled");
    expect(form.procedures).toEqual([]);
  });

  it("keeps offset-less wall-clock values as they are", () => {
    const form = mergeInitial({ startTime: "2026-06-15T10:00", endTime: "11:15:00" });
    expect([form.date, form.startTime, form.endDate, form.endTime]).toEqual([
      "2026-06-15",
      "10:00",
      "2026-06-15",
      "11:15",
    ]);
  });
});
