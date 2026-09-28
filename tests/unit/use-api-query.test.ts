// @vitest-environment jsdom
import { StrictMode, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  useApiQuery,
  type UseApiQueryResult,
} from "@/hooks/use-api-query";

type Query<T> = UseApiQueryResult<T>;

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface ProbeProps<T, D extends readonly unknown[]> {
  fetch: () => Promise<T>;
  deps: D;
  onError?: (error: unknown) => void;
  onRender: (query: Query<T>) => void;
}

function Probe<T, D extends readonly unknown[]>(props: ProbeProps<T, D>) {
  props.onRender(useApiQuery(props.fetch, props.deps, props.onError));
  return null;
}

let root: Root | null = null;

// Renders the hook and returns a getter for its latest result plus a way to
// render it again with new props (new deps, say).
async function renderQuery<T, D extends readonly unknown[]>(
  first: { fetch: () => Promise<T>; deps: D; onError?: (error: unknown) => void },
): Promise<{
  current: () => Query<T>;
  rerender: (next: {
    fetch?: () => Promise<T>;
    deps: D;
    onError?: (error: unknown) => void;
  }) => Promise<void>;
}> {
  const renders: Query<T>[] = [];
  const props: ProbeProps<T, D> = {
    ...first,
    onRender: (q: Query<T>) => renders.push(q),
  };
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(createElement<ProbeProps<T, D>>(Probe, props));
  });
  return {
    current: () => renders[renders.length - 1],
    rerender: async (next) => {
      Object.assign(props, next);
      await act(async () => {
        root?.render(createElement<ProbeProps<T, D>>(Probe, props));
      });
    },
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

describe("useApiQuery", () => {
  it("loads on mount and settles with the answer", async () => {
    const first = deferred<string>();
    const query = await renderQuery({ fetch: () => first.promise, deps: [1] });
    expect(query.current().loading).toBe(true);
    expect(query.current().data).toBeNull();

    await act(async () => {
      first.resolve("a");
    });
    expect(query.current().data).toBe("a");
    expect(query.current().loading).toBe(false);
    expect(query.current().error).toBeNull();
  });

  it("refetches when the deps change and drops the older answer", async () => {
    const old = deferred<string>();
    const fresh = deferred<string>();
    let calls = 0;
    const fetch = () => (++calls === 1 ? old.promise : fresh.promise);
    const query = await renderQuery({ fetch, deps: [1] });

    await query.rerender({ deps: [2] });
    expect(calls).toBe(2);
    expect(query.current().loading).toBe(true);

    // The first load finishes after the second one started: too late.
    await act(async () => {
      old.resolve("old");
    });
    expect(query.current().data).toBeNull();
    expect(query.current().loading).toBe(true);

    await act(async () => {
      fresh.resolve("fresh");
    });
    expect(query.current().data).toBe("fresh");
    expect(query.current().loading).toBe(false);
  });

  it("reload shows the loading state; a quiet reload keeps the data on screen", async () => {
    const loads = [deferred<string>(), deferred<string>(), deferred<string>()];
    let calls = 0;
    const fetch = () => loads[calls++].promise;
    const query = await renderQuery({ fetch, deps: [1] });
    await act(async () => {
      loads[0].resolve("a");
    });

    await act(async () => {
      query.current().reload();
    });
    expect(query.current().loading).toBe(true);
    expect(query.current().data).toBe("a");
    await act(async () => {
      loads[1].resolve("b");
    });
    expect(query.current().data).toBe("b");
    expect(query.current().loading).toBe(false);

    await act(async () => {
      query.current().reload({ quiet: true });
    });
    expect(calls).toBe(3);
    expect(query.current().loading).toBe(false);
    expect(query.current().data).toBe("b");
    await act(async () => {
      loads[2].resolve("c");
    });
    expect(query.current().data).toBe("c");
  });

  it("a failed reload sets the error, keeps the query's last good data and clears the error on success", async () => {
    const ok = deferred<string>();
    const bad = deferred<string>();
    const retry = deferred<string>();
    let calls = 0;
    const fetch = () =>
      ++calls === 1 ? ok.promise : calls === 2 ? bad.promise : retry.promise;
    const onError = vi.fn();
    const query = await renderQuery({ fetch, deps: [1], onError });
    await act(async () => {
      ok.resolve("a");
    });

    await act(async () => {
      query.current().reload({ quiet: true });
    });
    await act(async () => {
      bad.reject(new Error("boom"));
    });
    expect(query.current().error).toBe("boom");
    expect(query.current().data).toBe("a");
    expect(query.current().loading).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);

    await act(async () => {
      query.current().reload({ quiet: true });
    });
    await act(async () => {
      retry.resolve("c");
    });
    expect(query.current().error).toBeNull();
    expect(query.current().data).toBe("c");
  });

  it("a failed load for new deps drops the data the old deps loaded", async () => {
    const ok = deferred<string>();
    const bad = deferred<string>();
    let calls = 0;
    const fetch = () => (++calls === 1 ? ok.promise : bad.promise);
    const query = await renderQuery({ fetch, deps: [1] });
    await act(async () => {
      ok.resolve("a");
    });

    await query.rerender({ deps: [2] });
    await act(async () => {
      bad.reject(new Error("boom"));
    });
    expect(query.current().error).toBe("boom");
    expect(query.current().data).toBeNull();
    expect(query.current().loading).toBe(false);
  });

  it("reports nothing for a load that fails after unmount", async () => {
    const ok = deferred<string>();
    const pending = deferred<string>();
    let calls = 0;
    const fetch = () => (++calls === 1 ? ok.promise : pending.promise);
    const onError = vi.fn();
    const query = await renderQuery({ fetch, deps: [1], onError });
    await act(async () => {
      ok.resolve("a");
    });

    // New deps, then the screen goes away before their answer comes back.
    await query.rerender({ deps: [2], onError });
    await act(async () => {
      root?.unmount();
    });
    root = null;
    await act(async () => {
      pending.reject(new Error("boom"));
    });
    expect(calls).toBe(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("starts nothing when reloaded after unmount", async () => {
    const ok = deferred<string>();
    let calls = 0;
    const fetch = () =>
      ++calls === 1 ? ok.promise : Promise.reject(new Error("boom"));
    const onError = vi.fn();
    const query = await renderQuery({ fetch, deps: [1], onError });
    await act(async () => {
      ok.resolve("a");
    });
    const { reload } = query.current();

    await act(async () => {
      root?.unmount();
    });
    root = null;
    // A save that finishes after the user left reloads the screen that is gone.
    await act(async () => {
      reload();
    });
    expect(calls).toBe(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("still reloads after StrictMode runs the load effect twice", async () => {
    let calls = 0;
    const fetch = () => Promise.resolve(`answer ${++calls}`);
    const renders: Query<string>[] = [];
    const props: ProbeProps<string, [number]> = {
      fetch,
      deps: [1],
      onRender: (q) => renders.push(q),
    };
    root = createRoot(document.createElement("div"));
    await act(async () => {
      root?.render(
        createElement(StrictMode, null, createElement<ProbeProps<string, [number]>>(Probe, props)),
      );
    });
    const loadsOnMount = calls;
    expect(renders[renders.length - 1].data).toBe(`answer ${loadsOnMount}`);

    await act(async () => {
      renders[renders.length - 1].reload();
    });
    expect(calls).toBe(loadsOnMount + 1);
    expect(renders[renders.length - 1].data).toBe(`answer ${loadsOnMount + 1}`);
  });

  it("reports nothing for a reload that fails after unmount", async () => {
    const ok = deferred<string>();
    const reloaded = deferred<string>();
    let calls = 0;
    const fetch = () => (++calls === 1 ? ok.promise : reloaded.promise);
    const onError = vi.fn();
    const query = await renderQuery({ fetch, deps: [1], onError });
    await act(async () => {
      ok.resolve("a");
    });

    await act(async () => {
      query.current().reload({ quiet: true });
    });
    await act(async () => {
      root?.unmount();
    });
    root = null;
    await act(async () => {
      reloaded.reject(new Error("boom"));
    });
    expect(calls).toBe(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("a reload that replaces a pending load for new deps drops the old deps' data when it fails", async () => {
    const ok = deferred<string>();
    const pending = deferred<string>();
    const bad = deferred<string>();
    let calls = 0;
    const fetch = () =>
      ++calls === 1 ? ok.promise : calls === 2 ? pending.promise : bad.promise;
    const query = await renderQuery({ fetch, deps: [1] });
    await act(async () => {
      ok.resolve("a");
    });

    await query.rerender({ deps: [2] });
    await act(async () => {
      query.current().reload({ quiet: true });
    });
    await act(async () => {
      bad.reject(new Error("boom"));
    });
    expect(calls).toBe(3);
    expect(query.current().data).toBeNull();
    expect(query.current().error).toBe("boom");
  });
});
