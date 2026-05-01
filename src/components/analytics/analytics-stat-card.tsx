
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "./use-analytics";

/**
 * Endpoint-driven stat card.
 *
 * Pass an `endpoint` plus an `extract` selector that reads the number out of
 * whatever payload that endpoint returns. This way the same component works
 * for `/analytics/patients/total`, `/analytics/appointments/counts`, etc.
 *
 * Optional `format` maps the number to a string (currency, percent, …).
 */
export function AnalyticsStatCard<T>({
  title,
  endpoint,
  icon: Icon,
  extract,
  format,
  valueClassName,
}: {
  title: string;
  endpoint: string;
  icon: LucideIcon;
  extract: (data: T) => number;
  format?: (value: number) => string;
  valueClassName?: string;
}) {
  const { data, loading, error } = useAnalytics<T>(endpoint);

  const value =
    loading || error || data == null
      ? null
      : extract(data);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : error ? (
          <div className="text-sm text-destructive">—</div>
        ) : (
          <div className={`text-2xl font-bold ${valueClassName ?? ""}`}>
            {value == null
              ? "---"
              : format
                ? format(value)
                : value.toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
