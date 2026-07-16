import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInBeirut, getBeirutWallClockIssue } from "@/lib/tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  return err instanceof Error ? err.message : fallback;
}

export function formatMoney(
  amount: number | null | undefined,
  symbol = "$",
): string {
  const n = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  return `${symbol}${n.toFixed(2)}`;
}

export function clampNonNegative(value: string): string {
  if (value === "" || value === "-") return "";
  const n = Number(value);
  if (!Number.isNaN(n) && n < 0) return "0";
  return value;
}

// The backend rounds all monetary amounts to 2 decimals; mirror that on the
// frontend before sending/computing so displayed and stored values agree.
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isUnder18(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return false;
  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--;
  return age < 18;
}

export function formatTime(input: string | null | undefined): string {
  if (!input) return "---";
  // Full RFC3339 timestamps (UTC from the API) must be projected into Beirut
  // wall-clock before extracting HH:mm; otherwise late-evening Beirut slots
  // would display in UTC.
  const source = input.includes("T")
    ? formatInBeirut(input, "HH:mm")
    : input;
  const match = source.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "---";
  const hours = Number(match[1]);
  if (Number.isNaN(hours) || hours > 23) return "---";
  const period = hours < 12 ? "AM" : "PM";
  const h12 = hours % 12 || 12;
  return `${h12}:${match[2]} ${period}`;
}

export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s === "---" && e === "---") return "---";
  const annotations: string[] = [];
  if (start?.includes("T") && end?.includes("T")) {
    const startWall = formatInBeirut(start, "yyyy-MM-dd'T'HH:mm");
    const endWall = formatInBeirut(end, "yyyy-MM-dd'T'HH:mm");
    const startDay = startWall.slice(0, 10);
    const endDay = endWall.slice(0, 10);
    const dayDiff =
      (Date.parse(`${endDay}T00:00:00Z`) -
        Date.parse(`${startDay}T00:00:00Z`)) /
      86_400_000;
    if (dayDiff === 1) annotations.push("+1 day");
    else if (dayDiff > 1) annotations.push(`+${dayDiff} days`);

    const [startHour, startMinute] = startWall
      .slice(11)
      .split(":")
      .map(Number);
    const [endHour, endMinute] = endWall
      .slice(11)
      .split(":")
      .map(Number);
    const wallMinutes =
      dayDiff * 24 * 60 +
      endHour * 60 +
      endMinute -
      (startHour * 60 + startMinute);
    const elapsedMinutes = (Date.parse(end) - Date.parse(start)) / 60_000;
    // Ignore sub-minute timestamp noise; Beirut DST changes by a full hour.
    const touchesFold =
      getBeirutWallClockIssue(startWall) === "ambiguous" ||
      getBeirutWallClockIssue(endWall) === "ambiguous";
    if (touchesFold) {
      annotations.push("DST fold");
    } else if (
      Number.isFinite(elapsedMinutes) &&
      Math.abs(elapsedMinutes - wallMinutes) >= 30
    ) {
      annotations.push("DST adjusted");
    }
  }
  const suffix = annotations.length ? ` (${annotations.join(", ")})` : "";
  return `${s} - ${e}${suffix}`;
}
