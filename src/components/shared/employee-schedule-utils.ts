import type { EmployeeSchedule } from "@/lib/types";

// Fills shared by the employee schedule's calendar and table views, so a shift
// reads the same colour whichever view it is looked at in.
export const REGULAR_STYLE = "bg-positive/12 border-positive/55";
export const OVERTIME_STYLE =
  "bg-status-rescheduled/10 border-status-rescheduled/50";
export const PENDING_STYLE = "bg-foreground/5 border-dashed border-foreground/45";
export const REJECTED_STYLE = "bg-muted/40 border-muted-foreground/30 opacity-60";

export const offReasonStyle: Record<string, string> = {
  holiday: "bg-warning/20 border-warning/50",
  // Green marks the hours being worked, so time off uses a different colour:
  // an absence of work shouldn't share it.
  timeoff: "bg-status-cancelled/20 border-status-cancelled/55",
  "no-schedule": "bg-muted/30 border-border",
};

export const offReasonLabel: Record<string, string> = {
  holiday: "Holiday",
  timeoff: "Time Off",
  "no-schedule": "Off",
};

export const timeToDecimal = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
};

export const formatHours = (n: number) =>
  Number.isInteger(n) ? `${n}` : n.toFixed(1).replace(/\.0$/, "");

/** A shift as the day editor holds it, before it gets an id from the API. */
export type ShiftDraft = { startTime: string; endTime: string };

/**
 * One weekday's complete shift set, effective from a date. Every template row
 * sharing `(dayOfWeek, startDate)` belongs to the same version, and a version
 * is written and deleted whole; there is no per-shift create or update. The
 * gaps between its shifts are the breaks.
 */
export type EmployeeScheduleVersion = {
  /** 0 = Sunday, 6 = Saturday. */
  dayOfWeek: number;
  /** "YYYY-MM-DD". */
  startDate: string;
  /** Exclusive, and absent while the version is open-ended. */
  endDate?: string;
  /**
   * Belongs to the newest version of this weekday, *not* "in force today".
   * A version that starts next month is active while the one currently being
   * worked is not; use `versionInForce` to ask about a date.
   */
  isActive: boolean;
  /** Sorted by start time. */
  shifts: EmployeeSchedule[];
};

/** Collapses the flat `templates` list into one entry per editable version. */
export function groupScheduleVersions(
  templates: EmployeeSchedule[],
): EmployeeScheduleVersion[] {
  const byKey = new Map<string, EmployeeScheduleVersion>();
  for (const row of templates) {
    const startDate = (row.startDate ?? "").slice(0, 10);
    const key = `${row.dayOfWeek}|${startDate}`;
    const version = byKey.get(key);
    if (version) {
      version.shifts.push(row);
    } else {
      byKey.set(key, {
        dayOfWeek: row.dayOfWeek,
        startDate,
        endDate: row.endDate?.slice(0, 10) || undefined,
        isActive: row.isActive,
        shifts: [row],
      });
    }
  }
  const versions = [...byKey.values()];
  for (const version of versions) {
    version.shifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return versions;
}

/**
 * The version that governs `iso` for that weekday: the latest one starting on
 * or before the date that hasn't ended by it. `endDate` is exclusive: a
 * version ending 2026-08-10 does not cover 2026-08-10. `templates` deliberately
 * carries superseded versions, so a week viewed before a schedule change still
 * resolves to the version it was drawn from.
 */
export function versionInForce(
  versions: EmployeeScheduleVersion[],
  dayOfWeek: number,
  iso: string,
): EmployeeScheduleVersion | undefined {
  let match: EmployeeScheduleVersion | undefined;
  for (const version of versions) {
    if (version.dayOfWeek !== dayOfWeek) continue;
    if (version.startDate > iso) continue;
    if (version.endDate && version.endDate <= iso) continue;
    if (!match || version.startDate > match.startDate) match = version;
  }
  return match;
}

const TIME_PATTERN = /^\d{2}:\d{2}$/;

/**
 * Mirrors the rules the API enforces on a shift set. The API answers a bad set
 * with a generic "Please check your input", so validate here to be able to say
 * which shift is wrong.
 */
export function validateShifts(shifts: ShiftDraft[]): string | null {
  for (const [i, shift] of shifts.entries()) {
    if (
      !TIME_PATTERN.test(shift.startTime) ||
      !TIME_PATTERN.test(shift.endTime)
    ) {
      return `Shift ${i + 1} needs both a start and an end time.`;
    }
    if (timeToDecimal(shift.endTime) <= timeToDecimal(shift.startTime)) {
      return `Shift ${i + 1} must end after it starts — a shift can't run past midnight.`;
    }
  }
  // Touching shifts are allowed (09:00–13:00 + 13:00–18:00); only real overlap
  // is an error.
  const sorted = [...shifts].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (timeToDecimal(current.startTime) < timeToDecimal(previous.endTime)) {
      return `Shifts ${previous.startTime}–${previous.endTime} and ${current.startTime}–${current.endTime} overlap.`;
    }
  }
  return null;
}
