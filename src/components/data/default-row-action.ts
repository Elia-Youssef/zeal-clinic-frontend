import type { RowAction } from "@/components/data/data-row-actions";

/** The row's Edit action, when it is shown and enabled: what a click on the row opens. */
export function getDefaultRowAction<T>(
  row: T,
  actions?: RowAction<T>[],
): RowAction<T> | undefined {
  return actions?.find(
    (action) =>
      /^edit\b/i.test(action.label) &&
      !action.hidden?.(row) &&
      !action.disabled?.(row),
  );
}
