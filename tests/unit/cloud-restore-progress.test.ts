import { describe, expect, it } from "vitest";
import { isCloudRestoreProgressEvent } from "@/lib/cloud-restore-progress";

const valid = {
  status: "running",
  stage: "download",
  message: "Downloading the backup",
  step: 2,
  maxSteps: 5,
};

describe("isCloudRestoreProgressEvent", () => {
  it("accepts well-formed events in each status", () => {
    for (const status of ["running", "success", "failed"]) {
      expect(isCloudRestoreProgressEvent({ ...valid, status }), status).toBe(true);
    }
    expect(isCloudRestoreProgressEvent({ ...valid, extra: true })).toBe(true);
  });

  it("does not check the step against its range", () => {
    expect(isCloudRestoreProgressEvent({ ...valid, step: 0 })).toBe(true);
    expect(isCloudRestoreProgressEvent({ ...valid, step: -1 })).toBe(true);
    expect(isCloudRestoreProgressEvent({ ...valid, step: 9 })).toBe(true);
  });

  it("rejects anything that is not an object", () => {
    for (const value of [null, undefined, "running", 3, true, []]) {
      expect(isCloudRestoreProgressEvent(value), String(value)).toBe(false);
    }
  });

  it("rejects unknown statuses and missing or mistyped fields", () => {
    const broken: Record<string, unknown>[] = [
      { ...valid, status: "done" },
      { ...valid, stage: undefined },
      { ...valid, message: 42 },
      { ...valid, step: "2" },
      { ...valid, step: Number.NaN },
      { ...valid, step: Number.POSITIVE_INFINITY },
      { ...valid, maxSteps: 0 },
      { ...valid, maxSteps: -5 },
      { ...valid, maxSteps: Number.POSITIVE_INFINITY },
    ];
    for (const value of broken) {
      expect(isCloudRestoreProgressEvent(value), JSON.stringify(value)).toBe(false);
    }
  });
});
