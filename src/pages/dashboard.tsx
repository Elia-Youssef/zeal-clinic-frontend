
import {
  Users,
  AlertTriangle,
  DollarSign,
  Activity,
  Stethoscope,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Badge } from "@/components/ui/badge";
import type { Column } from "@/components/data/data-table";
import { AnalyticsStatCard } from "@/components/analytics/analytics-stat-card";
import { AnalyticsListCard } from "@/components/analytics/analytics-list-card";
import { AnalyticsChartCard } from "@/components/analytics/analytics-chart-card";
import { appointmentStatusTint, transactionColors } from "@/lib/constants";
import type { Appointment, BalanceTransaction } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";
import { formatTime } from "@/lib/utils";

type TotalPayload = { total: number };
type CancellationRate = { total: number; cancelled: number; rate: number };
type TopProcedure = { procedureId: string; name: string; count: number };

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

const timeOfDay = (iso: string) => formatTime(iso);

const appointmentColumns: Column<Appointment>[] = [
  {
    key: "patient",
    header: "Patient",
    render: (a) => {
      const procedures = a.appointmentProcedures
        ?.map((p) => p.procedureName)
        .filter(Boolean)
        .join(", ");
      return (
        <div>
          <p className="font-medium">{a.patientName ?? "Unknown"}</p>
          <p className="text-xs text-muted-foreground">
            {procedures || a.notes || "---"}
          </p>
        </div>
      );
    },
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
    render: (a) => (
      <Badge variant="outline" className={appointmentStatusTint(a.status)}>
        {a.status}
      </Badge>
    ),
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
          className={`font-bold ${income ? transactionColors.inflow : transactionColors.outflow}`}
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
  const { can } = usePermissions();

  return (
    <div className="space-y-6">
      {/* Primary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {can("analytics:read") && (
          <AnalyticsStatCard<TotalPayload>
            title="Total Patients"
            endpoint="/analytics/patients/total"
            icon={Users}
            extract={(d) => d.total}
          />
        )}
        {can("analytics:read") && (
          <AnalyticsStatCard<TotalPayload>
            title="Monthly Revenue"
            endpoint="/analytics/revenue/this-month"
            icon={DollarSign}
            extract={(d) => d.total}
            format={currency}
            valueClassName={transactionColors.inflow}
          />
        )}
        {can("analytics:read") && (
          <AnalyticsStatCard<TotalPayload>
            title="Monthly Expenses"
            endpoint="/analytics/expenses/this-month"
            icon={DollarSign}
            extract={(d) => d.total}
            format={currency}
            valueClassName={transactionColors.outflow}
          />
        )}
        {can("analytics:read") && (
          <AnalyticsStatCard<TotalPayload>
            title="Low Stock Alerts"
            endpoint="/analytics/inventory/low-stock"
            icon={AlertTriangle}
            extract={(d) => d.total}
            valueClassName={transactionColors.outflow}
          />
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {can("analytics:read") && (
          <AnalyticsStatCard<TotalPayload>
            title="New Patients (month)"
            endpoint="/analytics/patients/new-this-month"
            icon={TrendingUp}
            extract={(d) => d.total}
          />
        )}
        {can("analytics:read") && (
          <AnalyticsStatCard<TotalPayload>
            title="Procedures (month)"
            endpoint="/analytics/procedures/completed-this-month"
            icon={Activity}
            extract={(d) => d.total}
          />
        )}
        {can("analytics:read") && (
          <AnalyticsStatCard<TotalPayload>
            title="Outstanding Receivables"
            endpoint="/analytics/revenue/outstanding"
            icon={Stethoscope}
            extract={(d) => d.total}
            format={currency}
          />
        )}
        {can("analytics:read") && (
          <AnalyticsStatCard<CancellationRate>
            title="Cancellation Rate (month)"
            endpoint="/analytics/appointments/cancellation-rate"
            icon={TrendingDown}
            extract={(d) => d.rate}
            format={percent}
            valueClassName={transactionColors.outflow}
          />
        )}
      </div>

      {/* Revenue trend (last 30 days) */}
      {can("analytics:read") && (
        <AnalyticsChartCard
          title="Revenue — last 30 days"
          metric="revenue"
          groupBy="day"
          kind="area"
          formatValue={currency}
        />
      )}

      {/* Recent lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        {can("analytics:read") && (
          <AnalyticsListCard<Appointment>
            title="Today's Appointments"
            endpoint="/analytics/appointments/recent-today?limit=5"
            columns={appointmentColumns}
            rowKey={(a) => a.id}
            emptyMessage="No appointments today."
          />
        )}

        {can("analytics:read") && (
          <AnalyticsListCard<BalanceTransaction>
            title="Recent Transactions"
            endpoint="/analytics/transactions/recent?limit=5"
            columns={transactionColumns}
            rowKey={(t) => t.id}
            emptyMessage="No recent transactions."
          />
        )}
      </div>

      {/* Top procedures this month */}
      {can("analytics:read") && (
        <AnalyticsListCard<TopProcedure>
          title="Top Procedures (month)"
          endpoint="/analytics/procedures/top?limit=5"
          columns={topProcedureColumns}
          rowKey={(p) => p.procedureId}
          emptyMessage="No procedures completed yet this month."
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  usePageTitle("Dashboard");
  return <DashboardContent />;
}
