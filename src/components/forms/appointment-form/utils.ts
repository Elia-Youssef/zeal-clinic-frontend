import { formatInBeirut, wallClockToUtc } from "@/lib/tz";
import { type AppointmentFormData, emptyForm } from "./types";

// Appointment timestamps from the API are RFC3339 UTC; the form's date/time
// fields hold Beirut wall-clock so the picker reflects what the user typed.
export function mergeInitial(
  initial?: Partial<AppointmentFormData>,
): AppointmentFormData {
  if (!initial) return emptyForm;
  return {
    ...emptyForm,
    ...initial,
    procedures: initial.procedures ?? [],
    date:
      initial.date ??
      (initial.startTime ? formatInBeirut(initial.startTime, "yyyy-MM-dd") : ""),
    startTime: initial.startTime ? formatInBeirut(initial.startTime, "HH:mm") : "",
    endTime: initial.endTime ? formatInBeirut(initial.endTime, "HH:mm") : "",
  };
}

export function isPastStartTime(date: string, startTime: string) {
  if (!date || !startTime) return false;
  const startUtc = wallClockToUtc(`${date}T${startTime}`);
  const ms = new Date(startUtc).getTime();
  return !Number.isNaN(ms) && ms < Date.now();
}

export function timeDiffMinutes(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (
    [startHour, startMinute, endHour, endMinute].some((part) =>
      Number.isNaN(part),
    )
  ) {
    return 0;
  }
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}
