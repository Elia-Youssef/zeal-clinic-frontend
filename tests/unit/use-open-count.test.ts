// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useOpenCount } from "@/hooks/use-open-count";

type Commit = { open: boolean; count: number };

function Probe({ open, onCommit }: { open: boolean; onCommit: (commit: Commit) => void }) {
  const count = useOpenCount(open);
  useLayoutEffect(() => {
    onCommit({ open, count });
  });
  return null;
}

let root: Root | null = null;
let commits: Commit[] = [];

// Renders the hook with `open` (mounting it on the first call) and returns the committed count.
async function render(open: boolean): Promise<number> {
  root ??= createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(createElement(Probe, { open, onCommit: (commit) => commits.push(commit) }));
  });
  return commits[commits.length - 1].count;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  commits = [];
});

describe("useOpenCount", () => {
  it("counts each open and holds the count through the close", async () => {
    expect(await render(false)).toBe(0);
    expect(await render(true)).toBe(1);
    expect(await render(true)).toBe(1);
    expect(await render(false)).toBe(1);
    expect(await render(true)).toBe(2);
  });

  it("starts at zero when mounted open", async () => {
    expect(await render(true)).toBe(0);
    expect(await render(false)).toBe(0);
    expect(await render(true)).toBe(1);
  });

  it("commits the new count together with the open, never the old one", async () => {
    await render(false);
    await render(true);
    expect(commits).toEqual([
      { open: false, count: 0 },
      { open: true, count: 1 },
    ]);
  });
});
