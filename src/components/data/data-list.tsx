import { useCallback, useEffect, useState } from "react";
import {
  DataTable,
  type Column,
  type SortState,
} from "@/components/data/data-table";
import { type RowAction } from "@/components/data/data-row-actions";
import { DataPagination } from "@/components/data/data-pagination";
import { SearchBar } from "@/components/shared/search-bar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/shared/loading";
import { api, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_LIMIT = 100;

function isPaginated<T>(res: unknown): res is Paginated<T> {
  return (
    res !== null &&
    typeof res === "object" &&
    "items" in (res as Record<string, unknown>) &&
    "total" in (res as Record<string, unknown>)
  );
}

function useListData<T>({
  endpoint,
  offset,
  limit,
  filter,
  sort,
  refreshKey,
}: {
  endpoint: string;
  offset: number;
  limit: number;
  filter: string;
  sort: SortState | null;
  refreshKey: number;
}) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("offset", String(offset));
      params.set("limit", String(limit));
      if (filter) params.set("filter", filter);
      if (sort) {
        params.set("sort", sort.id);
        params.set("order", sort.dir);
      }
      const sep = endpoint.includes("?") ? "&" : "?";
      const res = await api.get<Paginated<T> | T[]>(
        `${endpoint}${sep}${params}`,
      );
      if (isPaginated<T>(res)) {
        setData(res.items);
        setTotal(res.total);
      } else {
        setData(res);
        setTotal(res.length);
      }
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [endpoint, offset, limit, filter, sort]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, refreshKey]);

  return { data, total, loading };
}

export function DataList<T>({
  title,
  endpoint,
  columns,
  rowKey,
  onRowClick,
  actions,
  headerActions,
  emptyMessage = "No data yet.",
  emptySearchMessage = "No results match your search.",
  limit = DEFAULT_LIMIT,
  refreshKey = 0,
  resetKey,
  hideSearch = false,
  className = "",
  rowClassName,
}: {
  title?: React.ReactNode;
  endpoint: string;
  columns: Column<T>[];
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  actions?: RowAction<T>[];
  headerActions?: React.ReactNode;
  emptyMessage?: string;
  emptySearchMessage?: string;
  limit?: number;
  refreshKey?: number;
  resetKey?: unknown;
  hideSearch?: boolean;
  className?: string;
  rowClassName?: (item: T) => string | undefined;
}) {
  const [offset, setOffset] = useState(0);
  const [filterInput, setFilterInput] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter(filterInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterInput]);

  useEffect(() => {
    setOffset(0);
    setFilterInput("");
    setFilter("");
    setSort(null);
  }, [resetKey]);

  const { data, total, loading } = useListData<T>({
    endpoint,
    offset,
    limit,
    filter,
    sort,
    refreshKey,
  });

  const hasHeader = !!(title || !hideSearch || headerActions);
  const hasPagination = total > limit;
  const isEmpty = !loading && data.length === 0;

  return (
    <Card
      className={cn(
        "flex flex-col min-w-0 max-h-[calc(100svh-9rem)] gap-0 py-0 overflow-hidden",
        className,
      )}
    >
      {hasHeader && (
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 border-b py-3">
          {title && (
            <CardTitle className="min-w-0 flex-1 basis-40 font-semibold">
              {title}
            </CardTitle>
          )}
          <div className="ml-auto flex max-w-full flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
            {!hideSearch && (
              <div className="min-w-48 flex-1 sm:w-56 sm:flex-initial">
                <SearchBar
                  value={filterInput}
                  onChange={setFilterInput}
                  placeholder="Search..."
                />
              </div>
            )}
            {headerActions && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {headerActions}
              </div>
            )}
          </div>
        </CardHeader>
      )}

      <div className="flex flex-1 min-h-0 flex-col">
        {loading ? (
          <div className="px-4 py-8">
            <Loading />
          </div>
        ) : isEmpty ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {filter ? emptySearchMessage : emptyMessage}
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            rowKey={rowKey}
            onRowClick={onRowClick}
            actions={actions}
            rowClassName={rowClassName}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setOffset(0);
            }}
            scrollable
            maxBodyHeight="max-h-full"
          />
        )}
      </div>

      {hasPagination && !loading && (
        <div className="border-t">
          <DataPagination
            offset={offset}
            limit={limit}
            total={total}
            onOffsetChange={setOffset}
          />
        </div>
      )}
    </Card>
  );
}
