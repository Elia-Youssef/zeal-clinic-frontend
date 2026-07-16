import type { CloudRestoreProgressEvent } from "@/lib/types";

export function isCloudRestoreProgressEvent(
  value: unknown,
): value is CloudRestoreProgressEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    (event.status === "running" ||
      event.status === "success" ||
      event.status === "failed") &&
    typeof event.stage === "string" &&
    typeof event.message === "string" &&
    typeof event.step === "number" &&
    Number.isFinite(event.step) &&
    typeof event.maxSteps === "number" &&
    Number.isFinite(event.maxSteps) &&
    event.maxSteps > 0
  );
}
