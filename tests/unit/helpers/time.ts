import { expect } from "vitest";

// Reads Asia/Beirut offsets and wall clocks straight from Intl, without the
// helpers under test, so every DST vector is first checked against the
// runtime's own time-zone data. A tzdata change then fails loudly here.

/** The zone this test process runs in (the TZ variable when it is set). */
export const RUNTIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Beirut",
  timeZoneName: "longOffset",
});

const wallClockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Beirut",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Beirut's offset from UTC in minutes at an instant. */
export function beirutOffsetMinutes(instant: Date | string | number): number {
  const name =
    offsetFormat
      .formatToParts(new Date(instant))
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = name.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** Beirut wall clock at an instant, as yyyy-MM-ddTHH:mm. */
export function beirutWallClock(instant: Date | string | number): string {
  const parts: Record<string, string> = {};
  for (const part of wallClockFormat.formatToParts(new Date(instant))) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Adds whole calendar days to a yyyy-MM-dd string. */
export function shiftDay(day: string, amount: number): string {
  const ms = Date.parse(`${day}T00:00:00Z`) + amount * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** The first minute (as epoch ms) whose Beirut calendar day is `day`. */
export function beirutDayStartMs(day: string): number {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  for (
    let ms = utcMidnight - 4 * 3_600_000;
    ms <= utcMidnight + 4 * 3_600_000;
    ms += 60_000
  ) {
    if (beirutWallClock(ms).startsWith(day)) return ms;
  }
  throw new Error(`No Beirut day start found for ${day}.`);
}

export type DstVector = {
  kind: "gap" | "fold";
  /** The Beirut calendar day that has 23 (gap) or 25 (fold) hours. */
  day: string;
  /** The UTC instant of the clock change. */
  switchAt: string;
  hours: number;
};

// Beirut changes its clocks at local midnight on the last Sunday of March and
// October. In March 00:00-00:59 is skipped; in October the clocks go back
// from Sunday 00:00 to Saturday 23:00, so 23:00-23:59 happens twice.
export const BEIRUT_DST_VECTORS: DstVector[] = [
  { kind: "gap", day: "2026-03-29", switchAt: "2026-03-28T22:00:00.000Z", hours: 23 },
  { kind: "fold", day: "2026-10-24", switchAt: "2026-10-24T21:00:00.000Z", hours: 25 },
  { kind: "gap", day: "2027-03-28", switchAt: "2027-03-27T22:00:00.000Z", hours: 23 },
  { kind: "fold", day: "2027-10-30", switchAt: "2027-10-30T21:00:00.000Z", hours: 25 },
];

export const GAP_VECTORS = BEIRUT_DST_VECTORS.filter((v) => v.kind === "gap");
export const FOLD_VECTORS = BEIRUT_DST_VECTORS.filter((v) => v.kind === "fold");

/** Checks a vector against Intl before a test relies on it. */
export function expectVectorHolds(vector: DstVector): void {
  const at = Date.parse(vector.switchAt);
  const minuteBefore = at - 60_000;
  if (vector.kind === "gap") {
    expect(beirutOffsetMinutes(minuteBefore)).toBe(120);
    expect(beirutOffsetMinutes(at)).toBe(180);
    expect(beirutWallClock(minuteBefore)).toBe(`${shiftDay(vector.day, -1)}T23:59`);
    expect(beirutWallClock(at)).toBe(`${vector.day}T01:00`);
  } else {
    expect(beirutOffsetMinutes(minuteBefore)).toBe(180);
    expect(beirutOffsetMinutes(at)).toBe(120);
    expect(beirutWallClock(minuteBefore)).toBe(`${vector.day}T23:59`);
    expect(beirutWallClock(at)).toBe(`${vector.day}T23:00`);
  }
  const length =
    beirutDayStartMs(shiftDay(vector.day, 1)) - beirutDayStartMs(vector.day);
  expect(length / 3_600_000).toBe(vector.hours);
}
