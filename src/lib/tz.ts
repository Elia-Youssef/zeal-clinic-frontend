import { addDays, format as fnsFormat } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

// The clinic operates in Beirut. All wall-clock interactions go through here.
// Lebanon observes DST (last Sun Mar -> last Sun Oct: UTC+3, otherwise UTC+2).
// Never hardcode the offset; the TZ name handles DST automatically.
export const BEIRUT_TZ = "Asia/Beirut";

export type BeirutWallClockIssue = "nonexistent" | "ambiguous";

const WALL_CLOCK_PATTERN = "yyyy-MM-dd'T'HH:mm:ss";

function normalizedWallClock(local: string): string | null {
  const match = local.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;
  return `${match[1]}T${match[2]}:${match[3]}:${match[4] ?? "00"}`;
}

/** Detect Beirut wall-clock values that cannot identify one exact instant. */
export function getBeirutWallClockIssue(
  local: string,
): BeirutWallClockIssue | null {
  const expected = normalizedWallClock(local);
  if (!expected) return "nonexistent";

  const instant = fromZonedTime(expected, BEIRUT_TZ);
  if (
    Number.isNaN(instant.getTime()) ||
    formatInTimeZone(instant, BEIRUT_TZ, WALL_CLOCK_PATTERN) !== expected
  ) {
    return "nonexistent";
  }

  // A fall-back fold maps two UTC instants to the same local clock. Beirut's
  // offset changes by one hour, while the wider checks keep this safe if the
  // IANA rules change to a 30- or 120-minute transition in the future.
  for (const minutes of [-120, -60, -30, 30, 60, 120]) {
    const alternate = new Date(instant.getTime() + minutes * 60_000);
    if (
      formatInTimeZone(alternate, BEIRUT_TZ, WALL_CLOCK_PATTERN) === expected
    ) {
      return "ambiguous";
    }
  }

  return null;
}

// Convert a Beirut wall-clock datetime string (e.g. "2026-04-10T14:30") to a
// UTC RFC3339 instant suitable for sending to the API.
// Accepts inputs with or without seconds.
export function wallClockToUtc(local: string): string {
  if (!local) return local;
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  const issue = getBeirutWallClockIssue(withSeconds);
  if (issue === "nonexistent") {
    throw new Error(
      "The selected Beirut time does not exist because of a daylight-saving transition.",
    );
  }
  if (issue === "ambiguous") {
    throw new Error(
      "The selected Beirut time occurs twice because of a daylight-saving transition.",
    );
  }
  return fromZonedTime(withSeconds, BEIRUT_TZ).toISOString();
}

function startOfBeirutDay(day: string): string {
  // Some Beirut DST changes skip 00:00 entirely. Advance through the small
  // transition window and return the first wall-clock minute that round-trips
  // to the requested calendar day.
  for (let minute = 0; minute <= 180; minute += 1) {
    const hour = String(Math.floor(minute / 60)).padStart(2, "0");
    const min = String(minute % 60).padStart(2, "0");
    const local = `${day}T${hour}:${min}:00`;
    const instant = fromZonedTime(local, BEIRUT_TZ);
    if (formatInTimeZone(instant, BEIRUT_TZ, WALL_CLOCK_PATTERN) === local) {
      return instant.toISOString();
    }
  }
  throw new Error(`Unable to resolve the start of Beirut day ${day}.`);
}

function addIsoCalendarDays(day: string, amount: number): string {
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid calendar day ${day}.`);
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + amount),
  )
    .toISOString()
    .slice(0, 10);
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
  const from = startOfBeirutDay(fromDay);
  const nextDay = addIsoCalendarDays(toDay, 1);
  const to = startOfBeirutDay(nextDay);
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
