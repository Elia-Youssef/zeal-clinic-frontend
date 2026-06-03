import { useMemo, useState, type ReactNode } from "react";
import { SlidersHorizontal, Printer } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import type { Column } from "@/components/data/data-table";
import { AnalyticsListCard } from "@/components/analytics/analytics-list-card";
import {
  FinancialPanel,
  PatientsPanel,
  OperationsPanel,
  AppointmentStatusCard,
  InventoryCard,
  RevenueMixCard,
  DemographicsCard,
  currency,
  withRange,
  type UtcRange,
} from "@/components/analytics/analytics-section-panels";
import { appointmentStatusTint, transactionColors } from "@/lib/constants";
import type { Appointment, BalanceTransaction } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { formatTime, getErrorMessage } from "@/lib/utils";
import { beirutDaysAgo, beirutToday, dateRangeToUtc } from "@/lib/tz";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

type ReferralSource = { source: string; count: number };
type StaffPerformance = {
  employeeId: string;
  name: string;
  procedures: number;
};
type TopProcedure = {
  procedureId: string;
  name: string;
  count: number;
  amount: number;
};
type TopProduct = { productId: string; name: string; quantity: number };
type RoomUtilization = {
  roomId: string;
  name: string;
  hours: number;
  appointments: number;
};

const timeOfDay = (iso: string) => formatTime(iso);

const appointmentColumns: Column<Appointment>[] = [
  {
    key: "patient",
    header: "Patient",
    className: "truncate",
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
    className: "truncate",
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

const referralColumns: Column<ReferralSource>[] = [
  {
    key: "source",
    header: "Source",
    className: "truncate",
    render: (r) => <span className="font-medium">{r.source || "---"}</span>,
  },
  {
    key: "count",
    header: "Patients",
    className: "w-24 text-right",
    render: (r) => <Badge variant="secondary">{r.count}</Badge>,
  },
];

const staffColumns: Column<StaffPerformance>[] = [
  {
    key: "name",
    header: "Employee",
    className: "truncate",
    render: (s) => <span className="font-medium">{s.name}</span>,
  },
  {
    key: "procedures",
    header: "Procedures",
    className: "w-28 text-right",
    render: (s) => <Badge variant="secondary">{s.procedures}</Badge>,
  },
];

const topProcedureColumns: Column<TopProcedure>[] = [
  {
    key: "name",
    header: "Procedure",
    className: "truncate",
    render: (p) => <span className="font-medium">{p.name}</span>,
  },
  {
    key: "count",
    header: "Count",
    className: "w-20 text-right",
    render: (p) => <Badge variant="secondary">{p.count}</Badge>,
  },
  {
    key: "amount",
    header: "Revenue",
    className: "w-28 text-right",
    render: (p) => (
      <span className="font-medium tabular-nums">{currency(p.amount)}</span>
    ),
  },
];

const topProductColumns: Column<TopProduct>[] = [
  {
    key: "name",
    header: "Product",
    className: "truncate",
    render: (p) => <span className="font-medium">{p.name}</span>,
  },
  {
    key: "quantity",
    header: "Qty",
    className: "w-20 text-right",
    render: (p) => <Badge variant="secondary">{p.quantity}</Badge>,
  },
];

const roomColumns: Column<RoomUtilization>[] = [
  {
    key: "name",
    header: "Room",
    className: "truncate",
    render: (r) => <span className="font-medium">{r.name}</span>,
  },
  {
    key: "hours",
    header: "Hours",
    className: "w-24 text-right",
    render: (r) => <span className="tabular-nums">{r.hours.toFixed(1)}h</span>,
  },
  {
    key: "appointments",
    header: "Appts",
    className: "w-20 text-right",
    render: (r) => <Badge variant="secondary">{r.appointments}</Badge>,
  },
];

type DashboardCard = {
  id: string;
  title: string;
  // The caller must hold ALL listed scopes (matches the backend's scopeAll gate).
  scopes: string[];
  // Full-width cards span every masonry column; the rest occupy one column.
  full?: boolean;
  render: (range: UtcRange) => ReactNode;
};

// Scopes required by /analytics/report/pdf (used to gate the Print button).
const PDF_SCOPES = [
  "analytics:read",
  "balances:read",
  "patients:read",
  "appointments:read",
  "products:read",
];

const DASHBOARD_CARDS: DashboardCard[] = [
  {
    id: "financial-kpis",
    title: "Financial",
    scopes: ["analytics:read", "balances:read"],
    full: true,
    render: (range) => <FinancialPanel range={range} />,
  },
  {
    id: "patient-kpis",
    title: "Patients",
    scopes: ["analytics:read", "patients:read"],
    full: true,
    render: (range) => <PatientsPanel range={range} />,
  },
  {
    id: "operations-kpis",
    title: "Operations",
    scopes: ["analytics:read", "appointments:read"],
    full: true,
    render: (range) => <OperationsPanel range={range} />,
  },
  {
    id: "demographics",
    title: "Demographics",
    scopes: ["analytics:read", "patients:read"],
    full: true,
    render: () => <DemographicsCard />,
  },
  {
    id: "appointment-status",
    title: "Appointment Status",
    scopes: ["analytics:read", "appointments:read"],
    render: (range) => <AppointmentStatusCard range={range} />,
  },
  {
    id: "inventory",
    title: "Inventory",
    scopes: ["analytics:read", "products:read"],
    render: () => <InventoryCard />,
  },
  {
    id: "revenue-payment-mix",
    title: "Revenue & Payment Mix",
    scopes: ["analytics:read", "balances:read"],
    render: (range) => <RevenueMixCard range={range} />,
  },
  {
    id: "referral-sources",
    title: "Referral Sources",
    scopes: ["analytics:read", "patients:read"],
    render: (range) => (
      <AnalyticsListCard<ReferralSource>
        title="Referral Sources"
        endpoint={withRange("/analytics/referral-sources", range)}
        columns={referralColumns}
        rowKey={(r) => r.source}
        emptyMessage="No referral data in this range."
      />
    ),
  },
  {
    id: "staff-performance",
    title: "Staff Performance",
    scopes: ["analytics:read", "employees:read"],
    render: (range) => (
      <AnalyticsListCard<StaffPerformance>
        title="Staff Performance"
        endpoint={withRange("/analytics/staff-performance", range)}
        columns={staffColumns}
        rowKey={(s) => s.employeeId}
        emptyMessage="No staff activity in this range."
      />
    ),
  },
  {
    id: "top-procedures",
    title: "Top Procedures",
    scopes: ["analytics:read", "procedures:read"],
    render: (range) => (
      <AnalyticsListCard<TopProcedure>
        title="Top Procedures"
        endpoint={withRange("/analytics/procedures/top?limit=5", range)}
        columns={topProcedureColumns}
        rowKey={(p) => p.procedureId}
        emptyMessage="No procedures completed in this range."
      />
    ),
  },
  {
    id: "top-products",
    title: "Top Products",
    scopes: ["analytics:read", "products:read"],
    render: (range) => (
      <AnalyticsListCard<TopProduct>
        title="Top Products"
        endpoint={withRange("/analytics/products/top?limit=5", range)}
        columns={topProductColumns}
        rowKey={(p) => p.productId}
        emptyMessage="No products sold in this range."
      />
    ),
  },
  {
    id: "rooms-utilization",
    title: "Room Utilization",
    scopes: ["analytics:read", "rooms:read"],
    render: (range) => (
      <AnalyticsListCard<RoomUtilization>
        title="Room Utilization"
        endpoint={withRange("/analytics/rooms/utilization", range)}
        columns={roomColumns}
        rowKey={(r) => r.roomId}
        emptyMessage="No room usage in this range."
      />
    ),
  },
  {
    id: "appointments-today",
    title: "Today's Appointments",
    scopes: ["analytics:read", "appointments:read"],
    render: () => (
      <AnalyticsListCard<Appointment>
        title="Today's Appointments"
        endpoint="/analytics/appointments/recent-today?limit=5"
        columns={appointmentColumns}
        rowKey={(a) => a.id}
        emptyMessage="No appointments today."
      />
    ),
  },
  {
    id: "recent-transactions",
    title: "Recent Transactions",
    scopes: ["analytics:read", "balances:read"],
    render: () => (
      <AnalyticsListCard<BalanceTransaction>
        title="Recent Transactions"
        endpoint="/analytics/transactions/recent?limit=5"
        columns={transactionColumns}
        rowKey={(t) => t.id}
        emptyMessage="No recent transactions."
      />
    ),
  },
];

function CustomizeMenu({ cards }: { cards: DashboardCard[] }) {
  const hidden = useDashboardStore((s) => s.hidden);
  const toggleHidden = useDashboardStore((s) => s.toggleHidden);
  const reset = useDashboardStore((s) => s.reset);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="size-4" />
            Customize
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64">
        <p className="px-1 text-xs font-medium text-muted-foreground">
          Show cards
        </p>
        <div className="flex flex-col gap-0.5">
          {cards.map((card) => {
            const visible = !hidden.includes(card.id);
            return (
              <label
                key={card.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent"
              >
                <Checkbox
                  checked={visible}
                  onCheckedChange={() => toggleHidden(card.id)}
                />
                <span className="text-sm">{card.title}</span>
              </label>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          onClick={() => reset()}
        >
          Show all
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <DatePicker
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        className="w-40"
        required
      />
    </div>
  );
}

function DashboardContent() {
  const { canAll } = usePermissions();
  const { addAlert } = useAlertStore();
  const hidden = useDashboardStore((s) => s.hidden);

  const [from, setFrom] = useState(beirutDaysAgo(30));
  const [to, setTo] = useState(beirutToday());
  const [pdfLoading, setPdfLoading] = useState(false);

  const range = useMemo<UtcRange>(
    () => (from && to ? dateRangeToUtc(from, to) : {}),
    [from, to],
  );

  const inScopeCards = useMemo(
    () => DASHBOARD_CARDS.filter((c) => canAll(...c.scopes)),
    [canAll],
  );

  const visibleCards = inScopeCards.filter((c) => !hidden.includes(c.id));
  const canPrint = canAll(...PDF_SCOPES);

  const handlePrint = async () => {
    setPdfLoading(true);
    try {
      await api.openPdf(withRange("/analytics/report/pdf", range));
    } catch (err) {
      addAlert("error", getErrorMessage(err, "Failed to generate PDF."));
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateField label="From" value={from} onChange={setFrom} max={to} />
          <DateField label="To" value={to} onChange={setTo} min={from} />
        </div>
        {(canPrint || inScopeCards.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {canPrint && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={pdfLoading}
              >
                <Printer className="size-4" />
                {pdfLoading ? "Loading…" : "Print"}
              </Button>
            )}
            {inScopeCards.length > 0 && <CustomizeMenu cards={inScopeCards} />}
          </div>
        )}
      </div>

      <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
        {visibleCards.map((card) => (
          <div
            key={card.id}
            className={`mb-4 break-inside-avoid ${card.full ? "[column-span:all]" : ""}`}
          >
            {card.render(range)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  usePageTitle("Dashboard");
  return <DashboardContent />;
}
