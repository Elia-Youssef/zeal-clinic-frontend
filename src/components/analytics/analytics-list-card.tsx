
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/data/data-table";
import { useAnalytics } from "./use-analytics";

/**
 * Endpoint-driven list card.
 *
 * Fetches an array from `endpoint` and renders it with <DataTable>.
 * The wrapping <Card> plus loading / error / empty state are handled here so
 * every recent-X panel on the dashboard shares identical shell + skeleton.
 */
export function AnalyticsListCard<T>({
  title,
  endpoint,
  columns,
  rowKey,
  onRowClick,
  emptyMessage = "Nothing to show.",
  headerAction,
  skeletonRows = 3,
}: {
  title: string;
  endpoint: string;
  columns: Column<T>[];
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  headerAction?: ReactNode;
  skeletonRows?: number;
}) {
  const { data, loading, error } = useAnalytics<T[]>(endpoint);

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-4 text-center text-sm text-destructive">{error}</p>
        ) : !data || data.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            rowKey={rowKey}
            onRowClick={onRowClick}
          />
        )}
      </CardContent>
    </Card>
  );
}
