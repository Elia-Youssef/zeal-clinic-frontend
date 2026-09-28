import { useState, type FocusEvent, type KeyboardEvent } from "react";

/**
 * The keyboard half of a click handler on an element that isn't a native button (a table row, a
 * calendar cell): Enter or Space on the element itself runs `action`. Keys pressed on a control
 * inside it (a row's menu button, say) are left to that control.
 */
export function onActivateKey(action: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    action();
  };
}

/**
 * Everything an element that isn't a native button needs to run `action` on a
 * click and from the keyboard (Enter or Space): spread it onto the element.
 * Nothing when there is no action, so the element stays inert. A clickable
 * table row passes `{ asButton: false }` to keep its row role, so the table
 * stays a table for screen readers.
 */
export function activatable(
  action: (() => void) | undefined,
  { asButton = true }: { asButton?: boolean } = {},
) {
  if (!action) return {};
  return {
    role: asButton ? ("button" as const) : undefined,
    tabIndex: 0,
    onClick: action,
    onKeyDown: onActivateKey(action),
  };
}

/** What a cell of a roving-focus grid carries: its place and its tab index. */
export interface RovingCellProps {
  "data-roving-row": number;
  "data-roving-col": number;
  tabIndex: 0 | -1;
}

/**
 * Roving focus for a grid of cells, so the whole grid costs one Tab stop:
 * spread `gridProps` onto the grid container and `cellProps(row, col)` onto
 * each cell. An arrow key moves the focus to the neighbouring cell that way
 * (nothing happens at an edge), and the stop follows the focus, so Tab leaves
 * the grid and Shift+Tab comes back to the cell last used; the first cell is
 * the stop until the focus moves. The arrows on a cell are the grid's alone:
 * taken in the capture phase and stopped there, they never reach the cell's
 * own key handling (a cell that is a menu trigger would open its menu on
 * ArrowDown or ArrowUp); every other key, Enter and Space included, does.
 */
export function useRovingFocus() {
  const [stop, setStop] = useState({ row: 0, col: 0 });

  const gridProps = {
    onKeyDownCapture: onRovingKey,
    onFocusCapture: (e: FocusEvent<HTMLElement>) => {
      const cell = rovingPlace(e.target);
      if (!cell) return;
      setStop((current) =>
        current.row === cell.row && current.col === cell.col ? current : cell,
      );
    },
  };

  const cellProps = (row: number, col: number): RovingCellProps => ({
    "data-roving-row": row,
    "data-roving-col": col,
    tabIndex: row === stop.row && col === stop.col ? 0 : -1,
  });

  return { gridProps, cellProps };
}

/** The place of a roving-focus cell, or null for anything else. */
function rovingPlace(target: EventTarget): { row: number; col: number } | null {
  if (!(target instanceof HTMLElement)) return null;
  const { rovingRow, rovingCol } = target.dataset;
  if (rovingRow === undefined || rovingCol === undefined) return null;
  return { row: Number(rovingRow), col: Number(rovingCol) };
}

/** The grid's arrow keys: moves the focus to the next cell that way. */
function onRovingKey(e: KeyboardEvent<HTMLElement>): void {
  const moves: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const move = moves[e.key];
  if (!move) return;
  const cell = rovingPlace(e.target);
  if (!cell) return;
  e.preventDefault();
  e.stopPropagation();
  const next = e.currentTarget.querySelector<HTMLElement>(
    `[data-roving-row="${cell.row + move[0]}"][data-roving-col="${cell.col + move[1]}"]`,
  );
  next?.focus();
}
