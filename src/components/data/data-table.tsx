import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  RowActionsMenu,
  getDefaultRowAction,
  type RowAction,
} from "@/components/data/data-row-actions";
import { cn } from "@/lib/utils";

export type { RowAction } from "@/components/data/data-row-actions";

export type SortDir = "asc" | "desc";
export type SortState = { id: string; dir: SortDir };

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
  /** Enables header sorting. */
  sortable?: boolean;
  /** Defaults to `key`. */
  sortKey?: string;
  /** Local sort accessor. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
};

const isSortable = <T,>(col: Column<T>) => !!col.sortable;

function SortIndicator({ dir }: { dir: SortDir | null }) {
  if (dir === "asc") return <ArrowUp className="size-3.5" />;
  if (dir === "desc") return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-40" />;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  actions,
  rowClassName,
  sort,
  onSortChange,
  scrollable = false,
  maxBodyHeight,
}: {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: RowAction<T>[];
  rowClassName?: (row: T) => string | undefined;
  /** Controlled sort; caller refetches when `onSortChange` is set. */
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;
  scrollable?: boolean;
  maxBodyHeight?: string;
}) {
  const controlled = onSortChange !== undefined;
  const [localSort, setLocalSort] = useState<SortState | null>(null);
  const activeSort = controlled ? (sort ?? null) : localSort;

  const setSort = (next: SortState | null) => {
    if (controlled) onSortChange!(next);
    else setLocalSort(next);
  };

  const sortIdFor = (col: Column<T>) => col.sortKey ?? col.key;

  const handleHeaderClick = (col: Column<T>) => {
    if (!isSortable(col)) return;
    const id = sortIdFor(col);
    if (!activeSort || activeSort.id !== id) {
      setSort({ id, dir: "asc" });
    } else if (activeSort.dir === "asc") {
      setSort({ id, dir: "desc" });
    } else {
      setSort({ id, dir: "asc" });
    }
  };

  const columnDefs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((col) => {
        const id = sortIdFor(col);
        const accessor =
          col.sortValue ??
          ((row: T) => {
            const v = (row as Record<string, unknown>)[col.key];
            if (v === null || v === undefined) return "";
            if (v instanceof Date) return v;
            if (typeof v === "string" || typeof v === "number") return v;
            return String(v);
          });
        return {
          id,
          accessorFn: accessor as (row: T) => unknown,
          enableSorting: isSortable(col),
          cell: ({ row }) => col.render(row.original),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns],
  );

  const sortingState: SortingState = useMemo(
    () =>
      activeSort
        ? [{ id: activeSort.id, desc: activeSort.dir === "desc" }]
        : [],
    [activeSort],
  );

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting: sortingState },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: controlled ? undefined : getSortedRowModel(),
    manualSorting: controlled,
  });

  const hasActions = !!actions && actions.length > 0;
  const activeSortColIndex = activeSort
    ? columns.findIndex((c) => sortIdFor(c) === activeSort.id)
    : -1;

  return (
    <Table
      containerClassName={cn(
        scrollable && "overflow-y-auto",
        scrollable && (maxBodyHeight ?? "max-h-full"),
      )}
    >
      <TableHeader
        className={cn(scrollable && "sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]")}
      >
        <TableRow>
          {columns.map((col, idx) => {
            const sortable = isSortable(col);
            const isSorted = idx === activeSortColIndex;
            const dir = isSorted ? activeSort!.dir : null;
            return (
              <TableHead
                key={col.key}
                className={cn(
                  col.className,
                  sortable && "cursor-pointer select-none hover:text-foreground",
                )}
                onClick={sortable ? () => handleHeaderClick(col) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {sortable && <SortIndicator dir={dir} />}
                  {isSorted && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-5"
                      aria-label="Reset sort"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSort(null);
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </span>
              </TableHead>
            );
          })}
          {hasActions && <TableHead className="w-10 text-right" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((tanRow) => {
          const row = tanRow.original;
          const extraClass = rowClassName?.(row);
          const defaultRowAction = onRowClick
            ? undefined
            : getDefaultRowAction(row, actions);
          const handleRowClick = onRowClick ?? defaultRowAction?.onClick;
          const cls = cn(handleRowClick && "cursor-pointer", extraClass);
          return (
            <TableRow
              key={rowKey(row)}
              onClick={handleRowClick ? () => handleRowClick(row) : undefined}
              className={cls || undefined}
            >
              {tanRow.getVisibleCells().map((cell, i) => {
                const col = columns[i];
                return (
                  <TableCell key={cell.id} className={col.className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
              {hasActions && (
                <TableCell className="w-10 text-right">
                  <div className="flex justify-end">
                    <RowActionsMenu row={row} actions={actions!} />
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
