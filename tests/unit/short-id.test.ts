import { describe, expect, it } from "vitest";
import { shortId } from "@/lib/utils";

describe("shortId", () => {
  it("shortens to the characters that differ between records made in the same minute", () => {
    // UUIDv7 ids share their leading characters while their creation timestamps agree.
    const first = "0192a7c0-5e3b-7abc-8000-3f9a2c1d4e5f";
    const second = "0192a7c0-5e3b-7def-8000-9b8e7d6c5b4a";
    expect(first.slice(0, 8)).toBe(second.slice(0, 8));
    expect(shortId(first)).toBe("2c1d4e5f");
    expect(shortId(second)).toBe("7d6c5b4a");
  });

  it("keeps an id that is already short, and an empty one, as it is", () => {
    expect(shortId("EUR")).toBe("EUR");
    expect(shortId("")).toBe("");
  });
});
