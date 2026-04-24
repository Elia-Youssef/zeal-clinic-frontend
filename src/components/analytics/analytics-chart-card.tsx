"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useAnalytics } from "./use-analytics";

export type SeriesMetric =
  | "revenue"
  | "appointments"
  | "new-patients"
  | "procedures-completed";

export type SeriesGroupBy = "day" | "week" | "month";

export type SeriesPoint = { bucket: string; value: number };

export type ChartKind = "area" | "line" | "bar";

/**
 * Endpoint-driven time-series chart backed by `/analytics/series`.
 *
 * Defaults follow the backend contract: from = today-29d, to = today,
 * groupBy = "day". Callers override only what they care about.
 *
 * `endpoint` is exposed as an escape hatch in case the backend adds
 * sibling time-series routes later (e.g. per-clinic, per-room).
 */
export function AnalyticsChartCard({
  title,
  metric,
  from,
  to,
  groupBy = "day",
  kind = "area",
  color = "var(--chart-1, #2563eb)",
  valueLabel,
  endpoint = "/analytics/series",
  formatValue,
}: {
  title: string;
  metric: SeriesMetric;
  from?: string;
  to?: string;
  groupBy?: SeriesGroupBy;
  kind?: ChartKind;
  color?: string;
  valueLabel?: string;
  endpoint?: string;
  formatValue?: (value: number) => string;
}) {
  const query = useMemo(() => {
    const params = new URLSearchParams({ metric, groupBy });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [metric, from, to, groupBy]);

  const { data, loading, error } = useAnalytics<SeriesPoint[]>(
    `${endpoint}?${query}`,
  );

  const label = valueLabel ?? defaultLabel(metric);

  const config: ChartConfig = {
    value: { label, color },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="aspect-video w-full" />
        ) : error ? (
          <p className="py-12 text-center text-sm text-red-500">{error}</p>
        ) : !data || data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No data for this range.
          </p>
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
            {renderChart(kind, data, color, formatValue)}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function defaultLabel(metric: SeriesMetric): string {
  switch (metric) {
    case "revenue":
      return "Revenue";
    case "appointments":
      return "Appointments";
    case "new-patients":
      return "New patients";
    case "procedures-completed":
      return "Procedures completed";
  }
}

function renderChart(
  kind: ChartKind,
  data: SeriesPoint[],
  color: string,
  formatValue?: (n: number) => string,
) {
  const axisProps = {
    dataKey: "bucket",
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    minTickGap: 24,
  } as const;

  const yAxisProps = {
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    width: 40,
    tickFormatter: (v: number) =>
      formatValue ? formatValue(v) : v.toLocaleString(),
  } as const;

  const tooltip = (
    <ChartTooltip
      cursor={false}
      content={
        <ChartTooltipContent
          indicator="dot"
          formatter={(value) =>
            formatValue && typeof value === "number"
              ? formatValue(value)
              : undefined
          }
        />
      }
    />
  );

  if (kind === "line") {
    return (
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis {...axisProps} />
        <YAxis {...yAxisProps} />
        {tooltip}
        <Line
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          type="monotone"
        />
      </LineChart>
    );
  }

  if (kind === "bar") {
    return (
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis {...axisProps} />
        <YAxis {...yAxisProps} />
        {tooltip}
        <Bar dataKey="value" fill={color} radius={4} />
      </BarChart>
    );
  }

  return (
    <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
      <defs>
        <linearGradient id="analytics-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.35} />
          <stop offset="95%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} />
      <XAxis {...axisProps} />
      <YAxis {...yAxisProps} />
      {tooltip}
      <Area
        dataKey="value"
        stroke={color}
        strokeWidth={2}
        fill="url(#analytics-chart-fill)"
        type="monotone"
      />
    </AreaChart>
  );
}
