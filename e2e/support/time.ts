// Clinic time for test data and expectations, computed with Intl rather than the app's own helpers so
// the tests don't share its assumptions. The clinic runs on Beirut time, whatever the browser zone is.
const CLINIC_ZONE = "Asia/Beirut";

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function wallClock(instant: Date, zone = CLINIC_ZONE): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** The clinic's calendar day of an instant, as yyyy-MM-dd. */
export function clinicDay(instant: Date = new Date()): string {
  const w = wallClock(instant);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

/** A calendar day `n` days after `day` (yyyy-MM-dd). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a calendar day. */
export function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Monday that starts the clinic week holding `day`: the clinic week runs Monday to Sunday, so a Sunday closes its week. */
export function clinicWeekMonday(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

function offsetMs(instant: number): number {
  const w = wallClock(new Date(instant));
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant of a clinic wall-clock time as the API takes it (UTC, RFC 3339):
 * clinicTime("2026-09-25", "14:30") -> "2026-09-25T11:30:00.000Z".
 */
export function clinicTime(day: string, hhmm: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let instant = wall - offsetMs(wall);
  instant = wall - offsetMs(instant);
  return new Date(instant).toISOString();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * A calendar day in the dashboard's date-fns patterns: EEEE (Friday), EEE (Fri), d, dd, MMM (Sep),
 * yyyy. For instance formatDay("2026-09-05", "EEEE d MMM") is "Saturday 5 Sep".
 */
export function formatDay(day: string, pattern: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const names: Record<string, string> = {
    EEEE: WEEKDAYS[weekday(day)],
    EEE: WEEKDAYS[weekday(day)].slice(0, 3),
    yyyy: String(y),
    MMM: MONTHS[m - 1],
    dd: pad(d),
    d: String(d),
  };
  return pattern.replace(/EEEE|EEE|yyyy|MMM|dd|d/g, (token) => names[token]);
}

/** The en-US short date the date picker uses in its data-day attribute ("9/5/2026" for 2026-09-05). */
export function pickerDayKey(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${m}/${d}/${y}`;
}
