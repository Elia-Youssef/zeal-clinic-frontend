import { addDays, format as fnsFormat, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

// The clinic operates in Beirut. All wall-clock interactions go through here.
// Lebanon observes DST (last Sun Mar -> last Sun Oct: UTC+3, otherwise UTC+2).
// Never hardcode the offset; the TZ name handles DST automatically.
export const BEIRUT_TZ = "Asia/Beirut";

// Convert a Beirut wall-clock datetime string (e.g. "2026-04-10T14:30") to a
// UTC RFC3339 instant suitable for sending to the API.
// Accepts inputs with or without seconds.
export function wallClockToUtc(local: string): string {
  if (!local) return local;
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return fromZonedTime(withSeconds, BEIRUT_TZ).toISOString();
}

// Convert a user-selected Beirut date-range (inclusive calendar days) to a
// half-open [from, to) RFC3339 UTC pair. `toDay` is treated as inclusive at
// the picker level, so we send the start of the following day as the
// exclusive upper bound. The next-day increment must happen on the calendar
// date *before* converting to UTC: adding 24h after conversion would lose or
// gain an hour at the Lebanese DST boundary (last Sun Mar / last Sun Oct).
export function dateRangeToUtc(
  fromDay: string,
  toDay: string,
): { from: string; to: string } {
  const from = fromZonedTime(`${fromDay}T00:00:00`, BEIRUT_TZ).toISOString();
  const nextDay = fnsFormat(addDays(parseISO(`${toDay}T00:00:00`), 1), "yyyy-MM-dd");
  const to = fromZonedTime(`${nextDay}T00:00:00`, BEIRUT_TZ).toISOString();
  return { from, to };
}

// Format any RFC3339 UTC timestamp in Beirut wall-clock. Defaults to a
// readable date+time. Use a custom pattern for table cells, etc.
export function formatInBeirut(
  ts: string | Date | null | undefined,
  pattern = "yyyy-MM-dd HH:mm",
): string {
  if (!ts) return "";
  return formatInTimeZone(ts, BEIRUT_TZ, pattern);
}

// Day-bucket key for grouping timestamps by Beirut calendar day. Use it instead
// of `ts.slice(0, 10)`, which keys by UTC date and mis-buckets late-evening
// Beirut events (21:00+ Beirut = next UTC day in winter, 22:00+ in DST).
export function beirutDayKey(ts: string | Date | null | undefined): string {
  if (!ts) return "";
  return formatInTimeZone(ts, BEIRUT_TZ, "yyyy-MM-dd");
}

// "Today" anchored to Beirut, as yyyy-MM-dd. Use for default date-range
// filters so the range doesn't silently shift a day between 21:00 and 24:00
// Beirut time.
export function beirutToday(): string {
  return formatInTimeZone(new Date(), BEIRUT_TZ, "yyyy-MM-dd");
}

// `n` days before Beirut "today", as yyyy-MM-dd.
export function beirutDaysAgo(n: number): string {
  const todayBeirut = toZonedTime(new Date(), BEIRUT_TZ);
  return fnsFormat(addDays(todayBeirut, -n), "yyyy-MM-dd");
}

// "Now" anchored to Beirut as a Date whose local fields (getDate/getHours/...)
// reflect Beirut wall-clock. Use ONLY when feeding date-fns helpers that work
// on local fields (startOfWeek, etc.); never send this to the API.
export function beirutNow(): Date {
  return toZonedTime(new Date(), BEIRUT_TZ);
}

// Same as beirutNow() but for an arbitrary instant, useful when a stored
// timestamp needs to be navigated in Beirut wall-clock terms.
export function beirutZoned(ts: string | Date): Date {
  return toZonedTime(ts, BEIRUT_TZ);
}
