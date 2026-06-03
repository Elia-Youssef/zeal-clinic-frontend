import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { transactionColors } from "@/lib/constants";

export const formatChange = (change: number) =>
  `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`;

function Delta({ change, invert }: { change: number; invert?: boolean }) {
  if (change === 0) {
    return (
      <p className={`text-xs font-medium ${transactionColors.neutral}`}>
        {formatChange(change)}
      </p>
    );
  }
  const up = change > 0;
  const good = invert ? !up : up;
  const color = good ? transactionColors.inflow : transactionColors.outflow;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className={`flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="size-3" />
      {formatChange(change)}
    </p>
  );
}

export function KpiTile({
  title,
  value,
  format,
  change,
  invert,
  loading,
  error,
}: {
  title: string;
  value: number | null;
  format?: (n: number) => string;
  change?: number | null;
  invert?: boolean;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-20" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-xl font-bold tabular-nums">
            {error || value == null
              ? "---"
              : format
                ? format(value)
                : value.toLocaleString()}
          </p>
          {!error && change != null && Number.isFinite(change) && (
            <Delta change={change} invert={invert} />
          )}
        </div>
      )}
    </div>
  );
}

export function KpiPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
      </CardContent>
    </Card>
  );
}
