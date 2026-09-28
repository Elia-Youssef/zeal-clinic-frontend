// @vitest-environment jsdom
import { act, createElement, type KeyboardEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { activatable, onActivateKey, useRovingFocus } from "@/lib/keyboard";

/** A key event whose target is the element the handler sits on, unless `inner` says otherwise. */
function keyEvent(key: string, inner = false) {
  const element = {};
  const event = {
    key,
    currentTarget: element,
    target: inner ? {} : element,
    preventDefault: vi.fn(),
  };
  return event as unknown as KeyboardEvent<HTMLElement> & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("onActivateKey", () => {
  it("runs the action on Enter and Space, and keeps Space from scrolling the page", () => {
    const action = vi.fn();
    const handler = onActivateKey(action);
    for (const key of ["Enter", " "]) {
      const event = keyEvent(key);
      handler(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("ignores other keys", () => {
    const action = vi.fn();
    const event = keyEvent("Tab");
    onActivateKey(action)(event);
    expect(action).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("leaves keys pressed on a control inside the element to that control", () => {
    const action = vi.fn();
    const event = keyEvent("Enter", true);
    onActivateKey(action)(event);
    expect(action).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("activatable", () => {
  it("wires a click and the keyboard to the action, as a button", () => {
    const action = vi.fn();
    const props = activatable(action);
    expect(props.role).toBe("button");
    expect(props.tabIndex).toBe(0);
    props.onClick?.();
    expect(action).toHaveBeenCalledOnce();
    const event = keyEvent("Enter");
    props.onKeyDown?.(event);
    expect(action).toHaveBeenCalledTimes(2);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("adds nothing without an action", () => {
    expect(activatable(undefined)).toEqual({});
  });

  it("can keep the element's own role, for a clickable table row", () => {
    const props = activatable(() => {}, { asButton: false });
    expect(props.role).toBeUndefined();
    expect(props.tabIndex).toBe(0);
  });
});

/**
 * A 2x2 roving-focus grid whose cells handle keys of their own, the way a menu
 * trigger opens its menu on ArrowDown.
 */
function Grid({ onCellKey }: { onCellKey: (key: string) => void }) {
  const { gridProps, cellProps } = useRovingFocus();
  const cells = [0, 1].flatMap((row) =>
    [0, 1].map((col) =>
      createElement("div", {
        key: `${row}:${col}`,
        ...cellProps(row, col),
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => onCellKey(e.key),
      }),
    ),
  );
  return createElement("div", gridProps, cells);
}

describe("useRovingFocus", () => {
  const cellKeys = vi.fn();
  let root: Root | null = null;
  let host: HTMLElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = null;
    host = null;
  });

  /** Renders the grid and returns a lookup for its cells. */
  function renderGrid() {
    const container = document.createElement("div");
    document.body.append(container);
    host = container;
    root = createRoot(container);
    act(() => {
      root?.render(createElement(Grid, { onCellKey: cellKeys }));
    });
    return (row: number, col: number) =>
      container.querySelector<HTMLElement>(`[data-roving-row="${row}"][data-roving-col="${col}"]`);
  }

  /** The cells a Tab can land on. */
  const tabStops = () => Array.from(host?.querySelectorAll('[tabindex="0"]') ?? []);

  /** Presses `key` on the focused element; true when the browser's default was prevented. */
  function press(key: string) {
    const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    act(() => {
      document.activeElement?.dispatchEvent(event);
    });
    return event.defaultPrevented;
  }

  it("moves the focus to the cell an arrow points at", () => {
    const cell = renderGrid();
    act(() => cell(0, 0)?.focus());
    press("ArrowRight");
    expect(document.activeElement).toBe(cell(0, 1));
    press("ArrowDown");
    expect(document.activeElement).toBe(cell(1, 1));
    press("ArrowLeft");
    expect(document.activeElement).toBe(cell(1, 0));
    press("ArrowUp");
    expect(document.activeElement).toBe(cell(0, 0));
  });

  it("is one Tab stop, the first cell until the focus moves, then the cell last focused", () => {
    const cell = renderGrid();
    expect(tabStops()).toEqual([cell(0, 0)]);
    act(() => cell(0, 0)?.focus());
    press("ArrowRight");
    press("ArrowDown");
    expect(tabStops()).toEqual([cell(1, 1)]);
    // A click focuses a cell too, and the stop follows.
    act(() => cell(1, 0)?.focus());
    expect(tabStops()).toEqual([cell(1, 0)]);
  });

  it("keeps the arrows from the cell's own key handling, at an edge too", () => {
    const cell = renderGrid();
    act(() => cell(1, 1)?.focus());
    expect(press("ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(cell(1, 1));
    press("ArrowUp");
    expect(document.activeElement).toBe(cell(0, 1));
    expect(cellKeys).not.toHaveBeenCalled();
  });

  it("leaves every other key to the cell", () => {
    const cell = renderGrid();
    act(() => cell(0, 0)?.focus());
    expect(press("Enter")).toBe(false);
    expect(cellKeys).toHaveBeenCalledWith("Enter");
    expect(document.activeElement).toBe(cell(0, 0));
  });
});
