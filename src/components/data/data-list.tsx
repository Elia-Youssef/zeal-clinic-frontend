import { useState, useEffect } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { useApiQuery } from "@/hooks/use-api-query";
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
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api, type Paginated } from "@/lib/api";
import { dateRangeToUtc } from "@/lib/tz";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";

const DEFAULT_LIMIT = 100;
const DEBOUNCE_DELAY_MS = 300;

function isPaginated<T>(res: unknown): res is Paginated<T> {
  return (
    res !== null &&
    typeof res === "object" &&
    "items" in (res as Record<string, unknown>) &&
    "total" in (res as Record<string, unknown>)
  );
}

/** One page of a list, in the shape both the paginated and plain answers give. */
interface ListPage<T> {
  items: T[];
  total: number;
}

function useListData<T>({
  endpoint,
  offset,
  limit,
  filter,
  from,
  to,
  sort,
  refreshKey,
}: {
  endpoint: string;
  offset: number;
  limit: number;
  filter: string;
  from: string;
  to: string;
  sort: SortState | null;
  refreshKey: number;
}) {
  const params = new URLSearchParams();
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  if (filter) params.set("filter", filter);
  if (from && to) {
    const range = dateRangeToUtc(from, to);
    params.set("from", range.from);
    params.set("to", range.to);
  }
  if (sort) {
    params.set("sort", sort.id);
    params.set("order", sort.dir);
  }
  const sep = endpoint.includes("?") ? "&" : "?";

  // A refreshKey change reloads the same query.
  const { data: page, loading } = useApiQuery<ListPage<T>>(
    () =>
      api.get<Paginated<T> | T[]>(`${endpoint}${sep}${params}`).then((res) =>
        isPaginated<T>(res)
          ? { items: res.items, total: res.total }
          : { items: res, total: res.length },
      ),
    [endpoint, offset, limit, filter, from, to, sort, refreshKey],
  );

  return { data: page?.items ?? [], total: page?.total ?? 0, loading };
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
  dateFilter = false,
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
  dateFilter?: boolean;
  className?: string;
  rowClassName?: (item: T) => string | undefined;
}) {
  const [offset, setOffset] = useState(0);
  const [offsetInput, setOffsetInput] = useState(0);
  const [filterInput, setFilterInput] = useState("");
  const [filter, setFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter(filterInput);
      setOffsetInput(0);
      setOffset(0);
    }, DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filterInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(offsetInput);
    }, DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [offsetInput]);

  useAdjustOnChange([resetKey], () => {
    setOffsetInput(0);
    setOffset(0);
    setFilterInput("");
    setFilter("");
    setFrom("");
    setTo("");
    setSort(null);
  });

  const { data, total, loading } = useListData<T>({
    endpoint,
    offset,
    limit,
    filter,
    from,
    to,
    sort,
    refreshKey,
  });

  const hasHeader = !!(title || !hideSearch || dateFilter || headerActions);
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
            {dateFilter && (
              <DateFilterButton
                from={from}
                to={to}
                onApply={(f, t) => {
                  setFrom(f);
                  setTo(t);
                  setOffsetInput(0);
                  setOffset(0);
                }}
              />
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
              setOffsetInput(0);
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
            offset={offsetInput}
            limit={limit}
            total={total}
            onOffsetChange={setOffsetInput}
          />
        </div>
      )}
    </Card>
  );
}

function DateFilterButton({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const active = !!(from && to);

  // Seed the draft from the applied range each time the popover opens.
  useAdjustOnChange([open, from, to], () => {
    if (open) {
      setDraftFrom(from);
      setDraftTo(to);
    }
  });

  const apply = () => {
    onApply(draftFrom, draftTo);
    setOpen(false);
  };

  const clear = () => {
    setDraftFrom("");
    setDraftTo("");
    onApply("", "");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant={active ? "secondary" : "outline"}
            size="sm"
            className="gap-1"
          />
        }
      >
        <Filter className="size-4" />
        Filter
        {active && (
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <FormField label="From" size="small">
          {({ id }) => (
            <DatePicker id={id} value={draftFrom} onChange={setDraftFrom} max={draftTo} />
          )}
        </FormField>
        <FormField label="To" size="small">
          {({ id }) => (
            <DatePicker id={id} value={draftTo} onChange={setDraftTo} min={draftFrom} />
          )}
        </FormField>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={clear} disabled={!active}>
            Clear
          </Button>
          <Button size="sm" onClick={apply} disabled={!draftFrom || !draftTo}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
