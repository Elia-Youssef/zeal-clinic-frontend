"use client";

import {
  Users,
  CalendarDays,
  AlertTriangle,
  DollarSign,
  Activity,
  Stethoscope,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Badge } from "@/components/ui/badge";
import type { Column } from "@/components/data-table";
import { AnalyticsStatCard } from "@/components/analytics/analytics-stat-card";
import { AnalyticsListCard } from "@/components/analytics/analytics-list-card";
import { AnalyticsChartCard } from "@/components/analytics/analytics-chart-card";
import { dashboardStatusColors } from "@/lib/constants";
import type { Appointment, BalanceTransaction } from "@/lib/types";

type TotalPayload = { total: number };
type AppointmentCounts = { today: number; thisWeek: number; thisMonth: number };
type CancellationRate = { total: number; cancelled: number; rate: number };
type TopProcedure = { procedureId: string; name: string; count: number };

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

const timeOfDay = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const appointmentColumns: Column<Appointment>[] = [
  {
    key: "patient",
    header: "Patient",
    render: (a) => (
      <div>
        <p className="font-medium">{a.patientName ?? "Unknown"}</p>
        <p className="text-xs text-muted-foreground">
          {a.patientProcedure?.procedureName ?? a.notes ?? "—"}
        </p>
      </div>
    ),
  },
  {
    key: "time",
    header: "Time",
    className: "w-24",
    render: (a) => (
      <span className="text-sm text-muted-foreground">
        {timeOfDay(a.startTime)}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    className: "w-32 text-right",
    render: (a) => {
      const statusKey = a.status?.toLowerCase() ?? "";
      return (
        <Badge
          className={
            dashboardStatusColors[statusKey] ?? "bg-gray-100 text-gray-800"
          }
        >
          {a.status}
        </Badge>
      );
    },
  },
];

const transactionColumns: Column<BalanceTransaction>[] = [
  {
    key: "description",
    header: "Description",
    render: (t) => (
      <div>
        <p className="font-medium">
          {t.description || `${t.fromEntityName} → ${t.toEntityName}`}
        </p>
        <p className="text-xs text-muted-foreground capitalize">
          {t.transactionType}
          {t.transactionMethod ? ` · ${t.transactionMethod}` : ""}
        </p>
      </div>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    className: "w-32 text-right",
    render: (t) => {
      const income = t.transactionType === "payment";
      return (
        <span
          className={`font-bold ${income ? "text-green-600" : "text-red-500"}`}
        >
          {income ? "+" : "-"}
          {currency(Math.abs(t.amount))}
        </span>
      );
    },
  },
];

const topProcedureColumns: Column<TopProcedure>[] = [
  {
    key: "name",
    header: "Procedure",
    render: (p) => <span className="font-medium">{p.name}</span>,
  },
  {
    key: "count",
    header: "Count",
    className: "w-20 text-right",
    render: (p) => <Badge variant="secondary">{p.count}</Badge>,
  },
];

function DashboardContent() {
  return (
    <div className="space-y-6">
      {/* Primary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStatCard<TotalPayload>
          title="Total Patients"
          endpoint="/analytics/patients/total"
          icon={Users}
          extract={(d) => d.total}
        />
        <AnalyticsStatCard<AppointmentCounts>
          title="Today's Appointments"
          endpoint="/analytics/appointments/counts"
          icon={CalendarDays}
          extract={(d) => d.today}
        />
        <AnalyticsStatCard<TotalPayload>
          title="Monthly Revenue"
          endpoint="/analytics/revenue/this-month"
          icon={DollarSign}
          extract={(d) => d.total}
          format={currency}
        />
        <AnalyticsStatCard<TotalPayload>
          title="Low Stock Alerts"
          endpoint="/analytics/inventory/low-stock"
          icon={AlertTriangle}
          extract={(d) => d.total}
          valueClassName="text-red-500"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStatCard<TotalPayload>
          title="New Patients (month)"
          endpoint="/analytics/patients/new-this-month"
          icon={TrendingUp}
          extract={(d) => d.total}
        />
        <AnalyticsStatCard<TotalPayload>
          title="Procedures (month)"
          endpoint="/analytics/procedures/completed-this-month"
          icon={Activity}
          extract={(d) => d.total}
        />
        <AnalyticsStatCard<TotalPayload>
          title="Outstanding Receivables"
          endpoint="/analytics/revenue/outstanding"
          icon={Stethoscope}
          extract={(d) => d.total}
          format={currency}
        />
        <AnalyticsStatCard<CancellationRate>
          title="Cancellation Rate (month)"
          endpoint="/analytics/appointments/cancellation-rate"
          icon={TrendingDown}
          extract={(d) => d.rate}
          format={percent}
          valueClassName="text-red-500"
        />
      </div>

      {/* Revenue trend (last 30 days) */}
      <AnalyticsChartCard
        title="Revenue — last 30 days"
        metric="revenue"
        groupBy="day"
        kind="area"
        formatValue={currency}
      />

      {/* Recent lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsListCard<Appointment>
          title="Today's Appointments"
          endpoint="/analytics/appointments/recent-today?limit=5"
          columns={appointmentColumns}
          rowKey={(a) => a.id}
          emptyMessage="No appointments today."
        />

        <AnalyticsListCard<BalanceTransaction>
          title="Recent Transactions"
          endpoint="/analytics/transactions/recent?limit=5"
          columns={transactionColumns}
          rowKey={(t) => t.id}
          emptyMessage="No recent transactions."
        />
      </div>

      {/* Top procedures this month */}
      <AnalyticsListCard<TopProcedure>
        title="Top Procedures (month)"
        endpoint="/analytics/procedures/top?limit=5"
        columns={topProcedureColumns}
        rowKey={(p) => p.procedureId}
        emptyMessage="No procedures completed yet this month."
      />
    </div>
  );
}

export default function DashboardPage() {
  usePageTitle("Dashboard");
  return <DashboardContent />;
}
