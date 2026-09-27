import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/data/data-table";
import { appointmentStatusTint } from "@/lib/constants";
import { useAnalytics } from "./use-analytics";
import { KpiPanel, KpiTile } from "./analytics-kpi-card";
import { currency, percent, withRange, type UtcRange } from "./analytics-format";

type Kpi ={ value: number; previous: number; change: number };

type MoneyKpis = {
  revenue: Kpi;
  expenses: Kpi;
  netProfit: Kpi;
  avgInvoice: Kpi;
  discounts: Kpi;
  refunds: Kpi;
  writeOffs: Kpi;
  receivables: number;
  payables: number;
  giftCardLiability: number;
  revenueMix: { procedures: number; products: number; gifts: number; other: number };
  paymentMix: { method: string; amount: number }[];
};

type PatientKpis = {
  newPatients: Kpi;
  returningPatients: Kpi;
  repeatRate: Kpi;
  activePatients: number;
};

type OperationKpis = {
  appointments: Kpi;
  proceduresPerformed: Kpi;
  cancellationRate: Kpi;
  rescheduleRate: Kpi;
  upcoming7Days: number;
  statusBreakdown: {
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    rescheduled: number;
    total: number;
  };
};

type Demographics = {
  gender: { label: string; count: number }[];
  ageBands: { label: string; count: number }[];
  topCities: { label: string; count: number }[];
};

export function FinancialPanel({ range }: { range: UtcRange }) {
  const { data, loading, error } = useAnalytics<MoneyKpis>(
    withRange("/analytics/money", range),
  );
  const err = !!error;
  return (
    <KpiPanel title="Financial">
      <KpiTile title="Revenue" value={data?.revenue.value ?? null} format={currency} change={data?.revenue.change ?? null} loading={loading} error={err} />
      <KpiTile title="Expenses" value={data?.expenses.value ?? null} format={currency} change={data?.expenses.change ?? null} invert loading={loading} error={err} />
      <KpiTile title="Net Profit" value={data?.netProfit.value ?? null} format={currency} change={data?.netProfit.change ?? null} loading={loading} error={err} />
      <KpiTile title="Avg Invoice" value={data?.avgInvoice.value ?? null} format={currency} change={data?.avgInvoice.change ?? null} loading={loading} error={err} />
      <KpiTile title="Discounts" value={data?.discounts.value ?? null} format={currency} change={data?.discounts.change ?? null} invert loading={loading} error={err} />
      <KpiTile title="Refunds" value={data?.refunds.value ?? null} format={currency} change={data?.refunds.change ?? null} invert loading={loading} error={err} />
      <KpiTile title="Write-offs" value={data?.writeOffs.value ?? null} format={currency} change={data?.writeOffs.change ?? null} invert loading={loading} error={err} />
      <KpiTile title="Receivables" value={data?.receivables ?? null} format={currency} loading={loading} error={err} />
      <KpiTile title="Payables" value={data?.payables ?? null} format={currency} loading={loading} error={err} />
      <KpiTile title="Gift Card Liability" value={data?.giftCardLiability ?? null} format={currency} loading={loading} error={err} />
    </KpiPanel>
  );
}

export function PatientsPanel({ range }: { range: UtcRange }) {
  const { data, loading, error } = useAnalytics<PatientKpis>(
    withRange("/analytics/patients", range),
  );
  const err = !!error;
  return (
    <KpiPanel title="Patients">
      <KpiTile title="New Patients" value={data?.newPatients.value ?? null} change={data?.newPatients.change ?? null} loading={loading} error={err} />
      <KpiTile title="Returning" value={data?.returningPatients.value ?? null} change={data?.returningPatients.change ?? null} loading={loading} error={err} />
      <KpiTile title="Repeat Rate" value={data?.repeatRate.value ?? null} format={percent} change={data?.repeatRate.change ?? null} loading={loading} error={err} />
      <KpiTile title="Active (180d)" value={data?.activePatients ?? null} loading={loading} error={err} />
    </KpiPanel>
  );
}

export function OperationsPanel({ range }: { range: UtcRange }) {
  const { data, loading, error } = useAnalytics<OperationKpis>(
    withRange("/analytics/operations", range),
  );
  const err = !!error;
  return (
    <KpiPanel title="Operations">
      <KpiTile title="Appointments" value={data?.appointments.value ?? null} change={data?.appointments.change ?? null} loading={loading} error={err} />
      <KpiTile title="Procedures" value={data?.proceduresPerformed.value ?? null} change={data?.proceduresPerformed.change ?? null} loading={loading} error={err} />
      <KpiTile title="Cancellation Rate" value={data?.cancellationRate.value ?? null} format={percent} change={data?.cancellationRate.change ?? null} invert loading={loading} error={err} />
      <KpiTile title="Reschedule Rate" value={data?.rescheduleRate.value ?? null} format={percent} change={data?.rescheduleRate.change ?? null} invert loading={loading} error={err} />
      <KpiTile title="Upcoming (7d)" value={data?.upcoming7Days ?? null} loading={loading} error={err} />
    </KpiPanel>
  );
}

export function AppointmentStatusCard({ range }: { range: UtcRange }) {
  const { data, loading, error } = useAnalytics<OperationKpis>(
    withRange("/analytics/operations", range),
  );
  const sb = data?.statusBreakdown;
  const statusRows: StatusRow[] = [
    { status: "Scheduled", count: sb?.scheduled ?? 0 },
    { status: "In-Progress", count: sb?.inProgress ?? 0 },
    { status: "Completed", count: sb?.completed ?? 0 },
    { status: "Cancelled", count: sb?.cancelled ?? 0 },
    { status: "Rescheduled", count: sb?.rescheduled ?? 0 },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointment Status</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-4 text-center text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-2">
            <MiniTable
              columns={statusColumns}
              rows={statusRows}
              rowKey={(r) => r.status}
              empty="No appointments in this range."
            />
            <div className="flex items-center justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold tabular-nums">{sb?.total ?? 0}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function InventoryCard() {
  const { data, loading, error } = useAnalytics<{
    lowStock: number;
    totalStockValue: number;
  }>("/analytics/inventory");
  const err = !!error;
  return (
    <KpiPanel title="Inventory">
      <KpiTile title="Low Stock" value={data?.lowStock ?? null} loading={loading} error={err} />
      <KpiTile title="Stock Value" value={data?.totalStockValue ?? null} format={currency} loading={loading} error={err} />
    </KpiPanel>
  );
}

function MiniTable<T>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return <DataTable columns={columns} data={rows} rowKey={rowKey} />;
}

type MixRow = { label: string; amount: number };
type DemoRow = { label: string; count: number };
type StatusRow = { status: string; count: number };

const mixColumns = (header: string): Column<MixRow>[] => [
  {
    key: "label",
    header,
    className: "truncate",
    render: (r) => <span className="font-medium capitalize">{r.label}</span>,
  },
  {
    key: "amount",
    header: "Amount",
    className: "w-28 text-right",
    render: (r) => <span className="tabular-nums">{currency(r.amount)}</span>,
  },
];

const demoColumns = (header: string): Column<DemoRow>[] => [
  {
    key: "label",
    header,
    className: "truncate",
    render: (r) => <span className="font-medium">{r.label}</span>,
  },
  {
    key: "count",
    header: "Patients",
    className: "w-24 text-right",
    render: (r) => <span className="tabular-nums">{r.count}</span>,
  },
];

const statusColumns: Column<StatusRow>[] = [
  {
    key: "status",
    header: "Status",
    className: "truncate",
    render: (r) => (
      <Badge variant="outline" className={appointmentStatusTint(r.status)}>
        {r.status}
      </Badge>
    ),
  },
  {
    key: "count",
    header: "Count",
    className: "w-20 text-right",
    render: (r) => <span className="font-medium tabular-nums">{r.count}</span>,
  },
];

export function RevenueMixCard({ range }: { range: UtcRange }) {
  const { data, loading, error } = useAnalytics<MoneyKpis>(
    withRange("/analytics/money", range),
  );
  const revenueRows = data
    ? [
        { label: "Procedures", amount: data.revenueMix.procedures },
        { label: "Products", amount: data.revenueMix.products },
        { label: "Gifts", amount: data.revenueMix.gifts },
        { label: "Other", amount: data.revenueMix.other },
      ]
    : [];
  const paymentRows = (data?.paymentMix ?? []).map((p) => ({
    label: p.method,
    amount: p.amount,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue &amp; Payment Mix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-4 text-center text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Revenue mix
              </p>
              <MiniTable
                columns={mixColumns("Category")}
                rows={revenueRows}
                rowKey={(r) => r.label}
                empty="No revenue in this range."
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Payment mix
              </p>
              <MiniTable
                columns={mixColumns("Method")}
                rows={paymentRows}
                rowKey={(r) => r.label}
                empty="No payments in this range."
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DemographicsCard() {
  const { data, loading, error } = useAnalytics<Demographics>(
    "/analytics/demographics",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demographics</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-4 text-center text-sm text-destructive">{error}</p>
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-3">
            <MiniTable
              columns={demoColumns("Gender")}
              rows={data?.gender ?? []}
              rowKey={(r) => r.label}
              empty="No data."
            />
            <MiniTable
              columns={demoColumns("Age band")}
              rows={data?.ageBands ?? []}
              rowKey={(r) => r.label}
              empty="No data."
            />
            <MiniTable
              columns={demoColumns("City")}
              rows={data?.topCities ?? []}
              rowKey={(r) => r.label}
              empty="No data."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
