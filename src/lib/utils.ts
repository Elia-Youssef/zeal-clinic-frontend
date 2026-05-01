import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Format a 24h time string into 12h "h:mm AM/PM" form.
 * Accepts "HH:mm", "HH:mm:ss", or ISO datetime "YYYY-MM-DDTHH:mm[:ss]".
 * Returns "---" when input is empty or unparseable.
 */
export function formatTime(input: string | null | undefined): string {
  if (!input) return "---";
  const match = input.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "---";
  const hours = Number(match[1]);
  if (Number.isNaN(hours) || hours > 23) return "---";
  const period = hours < 12 ? "AM" : "PM";
  const h12 = hours % 12 || 12;
  return `${h12}:${match[2]} ${period}`;
}

/** Format a start/end pair as "h:mm AM/PM - h:mm AM/PM". */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s === "---" && e === "---") return "---";
  return `${s} - ${e}`;
}
