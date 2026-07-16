import { formatInBeirut, wallClockToUtc } from "@/lib/tz";
import { type AppointmentFormData, emptyForm } from "./types";

const LOCAL_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const TIME_ONLY = /^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;

function toEditorParts(value?: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };

  // Calendar cells can seed the form with an already-local, offset-less
  // datetime. Keep those wall-clock fields intact instead of interpreting the
  // value as an instant and applying Beirut's offset a second time.
  const localMatch = value.match(LOCAL_DATE_TIME);
  if (localMatch) return { date: localMatch[1], time: localMatch[2] };

  const timeMatch = value.match(TIME_ONLY);
  if (timeMatch) return { date: "", time: timeMatch[1] };

  // Values returned by the API are RFC3339 instants. Project start and end
  // independently because an appointment may end on the following Beirut day.
  try {
    return {
      date: formatInBeirut(value, "yyyy-MM-dd"),
      time: formatInBeirut(value, "HH:mm"),
    };
  } catch {
    return { date: "", time: "" };
  }
}

// Appointment timestamps from the API are RFC3339 instants; the editor's
// date/time fields always hold Beirut wall-clock values.
export function mergeInitial(
  initial?: Partial<AppointmentFormData>,
): AppointmentFormData {
  if (!initial) return emptyForm;

  const start = toEditorParts(initial.startTime);
  const end = toEditorParts(initial.endTime);
  const date = initial.date ?? start.date;

  return {
    ...emptyForm,
    ...initial,
    procedures: initial.procedures ?? [],
    date,
    endDate: initial.endDate || end.date || date,
    startTime: start.time,
    endTime: end.time,
  };
}

function instantMs(
  date: string,
  time: string,
  preservedUtc?: string,
): number {
  if (preservedUtc) {
    const preservedMs = Date.parse(preservedUtc);
    if (Number.isFinite(preservedMs)) return preservedMs;
  }

  return Date.parse(wallClockToUtc(`${date}T${time}`));
}

export function isPastStartTime(
  date: string,
  startTime: string,
  preservedUtc?: string,
) {
  if (!date || !startTime) return false;
  try {
    const ms = instantMs(date, startTime, preservedUtc);
    return Number.isFinite(ms) && ms < Date.now();
  } catch {
    return false;
  }
}

export function timeDiffMinutes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  preservedStartUtc?: string,
  preservedEndUtc?: string,
) {
  if (!startDate || !startTime || !endDate || !endTime) return Number.NaN;

  try {
    const startMs = instantMs(startDate, startTime, preservedStartUtc);
    const endMs = instantMs(endDate, endTime, preservedEndUtc);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return Number.NaN;
    return (endMs - startMs) / 60_000;
  } catch {
    return Number.NaN;
  }
}

export function addCalendarDays(date: string, amount: number): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const next = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + amount),
  );
  return next.toISOString().slice(0, 10);
}

export function calendarDayDiff(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}
