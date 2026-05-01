import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/data/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/shared/loading";
import { api, type Paginated } from "@/lib/api";

function isPaginated<T>(res: unknown): res is Paginated<T> {
  return (
    res !== null &&
    typeof res === "object" &&
    "items" in (res as Record<string, unknown>) &&
    "total" in (res as Record<string, unknown>)
  );
}

const DEFAULT_LIMIT = 20;

export function DataList<T>({
  title,
  endpoint,
  columns,
  rowKey,
  onRowClick,
  actions,
  headerActions,
  searchPlaceholder = "Search…",
  emptyMessage = "No data yet.",
  emptySearchMessage = "No results match your search.",
  limit = DEFAULT_LIMIT,
  refreshKey = 0,
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
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptySearchMessage?: string;
  limit?: number;
  refreshKey?: number;
  hideSearch?: boolean;
  className?: string;
  rowClassName?: (item: T) => string | undefined;
}) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterInput, setFilterInput] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  /* Debounce the search input */
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter(filterInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterInput]);

  /* Fetch data from endpoint */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Most endpoints are paginated, but some dashboard tabs still return raw
      // arrays. This keeps the shared list component compatible with both while
      // still using the central Paginated<T> contract when available.
      const params = new URLSearchParams();
      params.set("offset", String(offset));
      params.set("limit", String(limit));
      if (filter) params.set("filter", filter);
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
  }, [endpoint, offset, limit, filter]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, refreshKey]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasHeader = !!(title || !hideSearch || headerActions);

  return (
    <Card className={"flex flex-col gap-4 min-w-0 " + className}>
      {hasHeader && (
        <CardHeader className="flex flex-row items-center justify-between">
          {title && <CardTitle className="font-semibold">{title}</CardTitle>}
          <div className="flex items-center justify-end gap-2">
            {!hideSearch && (
              <SearchBar
                value={filterInput}
                onChange={setFilterInput}
                placeholder={searchPlaceholder}
              />
            )}
            {headerActions && (
              <div className="flex items-center gap-2">{headerActions}</div>
            )}
          </div>
        </CardHeader>
      )}

      <div className={hasHeader ? "border-t border-border/70" : undefined}>
        {loading ? (
          <div className="px-4 py-8">
            <Loading />
          </div>
        ) : data.length === 0 ? (
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
          />
        )}
      </div>

      {totalPages > 1 && !loading && (
        <CardFooter className="justify-between">
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={offset === 0}
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-sm">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={offset + limit >= total}
              onClick={() => setOffset((prev) => prev + limit)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
