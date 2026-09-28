import { beirutDayKey, formatInBeirut } from "@/lib/tz";

export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;
export const HOUR_HEIGHT = 7.5;
export const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => i + DAY_START_HOUR,
);
export const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
export const GRID_TOTAL_MINUTES = HOURS.length * 60;

export const GRID_LEAD_REM = 3.3 + 0.75;

export const gridColsFor = (roomCount: number) =>
  `3.3rem 0.75rem repeat(${roomCount}, 1fr)`;

export function isoToDate(iso: string) {
  return beirutDayKey(iso);
}

export function isoToTime(iso: string) {
  return formatInBeirut(iso, "HH:mm");
}

export function formatHour(hour: number) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h} ${ampm}`;
}

export function formatQuarterHour(hour: number, minute: number) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:${String(minute).padStart(2, "0")} ${ampm}`;
}

export function timeToDecimal(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

export function isoToGridMinutes(iso: string) {
  return Math.round((timeToDecimal(isoToTime(iso)) - DAY_START_HOUR) * 60);
}

export function gridMinutesToWallClock(min: number) {
  const total = DAY_START_HOUR * 60 + min;
  return `${padHour(Math.floor(total / 60))}:${String(total % 60).padStart(2, "0")}`;
}

export function formatGridMinutes(min: number) {
  const total = DAY_START_HOUR * 60 + min;
  return formatQuarterHour(Math.floor(total / 60), total % 60);
}

// The calendar carries clinic wall-clock in a Date's local fields (beirutNow(),
// beirutZoned(), the picked day, and the day arithmetic on them), so the
// calendar day is those fields, whatever zone the browser is in. An instant
// from the API is not a calendar day: zone it first (beirutZoned) or use
// beirutDayKey.
export function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function padHour(hour: number) {
  return String(hour).padStart(2, "0");
}
