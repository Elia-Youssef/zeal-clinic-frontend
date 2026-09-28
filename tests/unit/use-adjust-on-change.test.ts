// @vitest-environment jsdom
import { act, createElement, useLayoutEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";

/**
 * Renders the hook: the count bumps once per adjust, a layout effect logs the
 * count each commit puts on screen, and each adjust records the deps it saw.
 */
function Probe({
  id,
  commits,
  previousDeps,
}: {
  id: number;
  commits: number[];
  previousDeps: Array<readonly unknown[] | null>;
}) {
  const [count, setCount] = useState(0);
  useAdjustOnChange([id], (previous) => {
    previousDeps.push(previous);
    setCount((n) => n + 1);
  });
  useLayoutEffect(() => {
    commits.push(count);
  });
  return null;
}

let root: Root | null = null;

// Renders the probe and returns a way to render it again with new props.
async function renderProbe(
  first: {
    id: number;
    commits: number[];
    previousDeps: Array<readonly unknown[] | null>;
  },
): Promise<(next: { id: number }) => Promise<void>> {
  const props = { ...first };
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(createElement(Probe, props));
  });
  return async (next) => {
    Object.assign(props, next);
    await act(async () => {
      root?.render(createElement(Probe, props));
    });
  };
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("useAdjustOnChange", () => {
  it("runs on the first render, before that render is committed", async () => {
    const commits: number[] = [];
    const previousDeps: Array<readonly unknown[] | null> = [];
    await renderProbe({ id: 1, commits, previousDeps });
    // The first commit already shows the bump; adjusting in an effect would
    // commit the initial 0 first.
    expect(commits).toEqual([1]);
    expect(previousDeps).toEqual([null]);
  });

  it("runs again only when a dep actually changes, before that change is committed", async () => {
    const commits: number[] = [];
    const previousDeps: Array<readonly unknown[] | null> = [];
    const rerender = await renderProbe({ id: 1, commits, previousDeps });

    await rerender({ id: 1 });
    expect(commits).toEqual([1, 1]);
    expect(previousDeps).toEqual([null]);

    // The commit for the new dep shows the bump straight away; adjusting in
    // an effect would commit the old count with the new dep first.
    await rerender({ id: 2 });
    expect(commits).toEqual([1, 1, 2]);
    expect(previousDeps).toEqual([null, [1]]);
  });
});
