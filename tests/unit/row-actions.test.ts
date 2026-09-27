import { describe, expect, it, vi } from "vitest";
import { getDefaultRowAction } from "@/components/data/default-row-action";
import type { RowAction } from "@/components/data/data-row-actions";

type Row = { id: string; locked: boolean };

const row: Row = { id: "r1", locked: false };

function action(label: string, extra: Partial<RowAction<Row>> = {}): RowAction<Row> {
  return { label, onClick: () => {}, ...extra };
}

describe("getDefaultRowAction", () => {
  it("returns nothing without actions", () => {
    expect(getDefaultRowAction(row)).toBeUndefined();
    expect(getDefaultRowAction(row, [])).toBeUndefined();
  });

  it("picks the first action whose label starts with the word Edit", () => {
    const view = action("View");
    const edit = action("Edit patient");
    expect(getDefaultRowAction(row, [view, edit, action("Edit again")])).toBe(edit);
    expect(getDefaultRowAction(row, [action("edit")])?.label).toBe("edit");
    expect(getDefaultRowAction(row, [action("Edit-mode")])?.label).toBe("Edit-mode");
  });

  it("ignores labels where Edit is not a leading word", () => {
    expect(getDefaultRowAction(row, [action("Editor"), action("Quick edit")])).toBeUndefined();
  });

  it("skips hidden and disabled edit actions, asking with the row", () => {
    const hidden = vi.fn((r: Row) => r.id === "r1");
    const disabled = vi.fn(() => true);
    const fallback = action("Edit details");
    const chosen = getDefaultRowAction(row, [
      action("Edit", { hidden }),
      action("Edit", { disabled }),
      fallback,
    ]);
    expect(chosen).toBe(fallback);
    expect(hidden).toHaveBeenCalledWith(row);
    expect(disabled).toHaveBeenCalledWith(row);
  });
});
