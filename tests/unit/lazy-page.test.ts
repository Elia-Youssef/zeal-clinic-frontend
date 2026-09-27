// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPage, RELOAD_FLAG } from "@/lib/lazy-page";

const PAGE = { default: () => null };

function stubReload() {
  const reload = vi.fn();
  vi.stubGlobal("location", { reload });
  return reload;
}

/** Resolves to "pending" when `promise` has not settled within a tick. */
function outcome(promise: Promise<unknown>): Promise<unknown> {
  return Promise.race([
    promise.then(() => "resolved", () => "rejected"),
    new Promise((resolve) => setTimeout(() => resolve("pending"), 20)),
  ]);
}

afterEach(() => {
  sessionStorage.clear();
});

describe("loadPage", () => {
  it("returns the chunk and forgets an earlier reload", async () => {
    sessionStorage.setItem(RELOAD_FLAG, "1");
    const reload = stubReload();

    await expect(loadPage(() => Promise.resolve(PAGE))).resolves.toBe(PAGE);

    expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads the page once when a chunk fails to load", async () => {
    const reload = stubReload();
    const failing = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module"));

    const first = loadPage(failing);
    expect(await outcome(first)).toBe("pending");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBe("1");

    // The reloaded page fails again: the error surfaces, no second reload.
    await expect(loadPage(failing)).rejects.toThrow("Failed to fetch dynamically imported module");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBe("1");
  });
});
