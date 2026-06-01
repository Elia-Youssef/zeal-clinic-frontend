import { beirutDayKey, formatInBeirut } from "@/lib/tz";

export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;
export const HOUR_HEIGHT = 7.5; // rem; follows UI scale.
export const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => i + DAY_START_HOUR,
);
export const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;

export const gridColsFor = (roomCount: number) =>
  `3.3rem 0.75rem repeat(${roomCount}, 1fr)`;

// Stored appointment times are RFC3339 UTC. Bucket and display them as the
// clinic's wall-clock (Beirut) so a 1 AM Beirut slot doesn't bleed into the
// previous UTC day in the schedule grid.
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

export function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getWeekStart(date: Date) {
  // Week starts on Monday.
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export function getWeekDays(date: Date) {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function padHour(hour: number) {
  return String(hour).padStart(2, "0");
}
