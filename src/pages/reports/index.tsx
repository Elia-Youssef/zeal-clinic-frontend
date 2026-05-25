import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { Tabs } from "@/components/shared/tabs";
import { Loading } from "@/components/shared/loading";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import {
  beirutDaysAgo,
  beirutToday,
  dateRangeToUtc,
  formatInBeirut,
} from "@/lib/tz";

const reportTabs = ["Revenue", "Expenses"];

type RevenueLevel =
  | "kind"
  | "procedure-type"
  | "procedure-category"
  | "product-category"
  | "procedure"
  | "product";

type RevenueItem = {
  groupType: string;
  entityId: string;
  entityName: string;
  quantity: number;
  amount: number;
  percentage: number;
};

type RevenueResponse = {
  level: RevenueLevel;
  items: RevenueItem[];
  totals: { quantity: number; amount: number };
};

type ExpenseRow = {
  date: string;
  supplier: string;
  description: string;
  quantity: number;
  amountPerUnit: number;
  amount: number;
  remainingBalance: number;
  total: number;
  notes: string;
};

const levelOptions: { value: RevenueLevel; label: string }[] = [
  { value: "kind", label: "Item kinds" },
  { value: "procedure-type", label: "Procedure types" },
  { value: "procedure-category", label: "Procedure categories" },
  { value: "product-category", label: "Product categories" },
  { value: "procedure", label: "Procedures" },
  { value: "product", label: "Products" },
];

function formatMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  if (!value) return "";
  // Backend returns either a pure date (yyyy-MM-dd) or an RFC3339 timestamp.
  // Format both as the clinic's local calendar day in Beirut.
  if (value.includes("T")) return formatInBeirut(value, "dd/MM/yyyy");
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function buildQuery(params: Record<string, string>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

function levelHeader(level: RevenueLevel | undefined): string {
  switch (level) {
    case "kind":
      return "Item Kind";
    case "procedure-type":
      return "Procedure Type";
    case "procedure-category":
      return "Procedure Category";
    case "product-category":
      return "Product Category";
    case "procedure":
      return "Procedure";
    case "product":
      return "Product";
    default:
      return "Name";
  }
}

export default function ReportsPage() {
  usePageTitle("Reports");
  const [tab, setTab] = useState(reportTabs[0]);

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Tabs tabs={reportTabs} activeTab={tab} onChange={setTab} />
      </div>
      {tab === "Revenue" ? <RevenueReport /> : <ExpensesReport />}
    </div>
  );
}

function RevenueReport() {
  const { addAlert } = useAlertStore();
  const [from, setFrom] = useState(beirutDaysAgo(30));
  const [to, setTo] = useState(beirutToday());
  const [level, setLevel] = useState<RevenueLevel>("kind");
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePrintPdf = async () => {
    setPdfLoading(true);
    try {
      const range = dateRangeToUtc(from, to);
      const params: Record<string, string> = { ...range, level };
      await api.openPdf(`/reports/revenue/pdf${buildQuery(params)}`);
    } catch (err) {
      addAlert("error", getErrorMessage(err, "Failed to generate PDF."));
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    let aborted = false;
    const range = dateRangeToUtc(from, to);
    const params: Record<string, string> = { ...range, level };
    setLoading(true);
    api
      .get<RevenueResponse>(`/reports/revenue${buildQuery(params)}`)
      .then((res) => {
        if (!aborted) setData(res);
      })
      .catch((err) => {
        if (!aborted)
          addAlert(
            "error",
            getErrorMessage(err, "Failed to load revenue report."),
          );
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [from, to, level, addAlert]);

  return (
    <>
      <div className="rounded-lg border bg-muted/30 p-3 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <DateField label="From" value={from} onChange={setFrom} max={to} />
          <DateField label="To" value={to} onChange={setTo} min={from} />
          <div className="w-full space-y-1.5 sm:w-56">
            <label className="text-xs font-medium text-muted-foreground">
              Group by
            </label>
            <SearchableDropdown
              value={level}
              onChange={(v) => setLevel(v as RevenueLevel)}
              options={levelOptions}
            />
          </div>
          <div className="w-full sm:ml-auto sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPdf}
              disabled={pdfLoading}
              className="w-full sm:w-auto"
            >
              <Printer className="size-4" />
              {pdfLoading ? "Loading…" : "Print"}
            </Button>
          </div>
        </div>
      </div>

      <PrintableSheet
        title="Revenue Report"
        subtitle={`${formatDate(from)} — ${formatDate(to)}`}
      >
        {loading ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No data for the selected range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-foreground/80">
                  <th className="px-3 py-2 text-left font-semibold">
                    {levelHeader(data.level)}
                  </th>
                  <th className="w-24 px-3 py-2 text-right font-semibold">
                    Qty
                  </th>
                  <th className="w-32 px-3 py-2 text-right font-semibold">
                    Amount
                  </th>
                  <th className="w-20 px-3 py-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, idx) => (
                  <tr
                    key={`${it.entityId}-${idx}`}
                    className="border-b border-foreground/10"
                  >
                    <td className="px-3 py-2">
                      {it.entityName}
                      {!it.entityId && (
                        <span className="ml-1 text-muted-foreground">
                          (uncategorized)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(it.amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {it.percentage.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/80 font-semibold">
                  <td className="px-3 py-2 text-left">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {data.totals.quantity}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(data.totals.amount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">100.0</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </PrintableSheet>
    </>
  );
}

function ExpensesReport() {
  const { addAlert } = useAlertStore();
  const [from, setFrom] = useState(beirutDaysAgo(30));
  const [to, setTo] = useState(beirutToday());
  const [rows, setRows] = useState<ExpenseRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePrintPdf = async () => {
    setPdfLoading(true);
    try {
      const params: Record<string, string> = dateRangeToUtc(from, to);
      await api.openPdf(`/reports/expenses/pdf${buildQuery(params)}`);
    } catch (err) {
      addAlert("error", getErrorMessage(err, "Failed to generate PDF."));
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    let aborted = false;
    const params: Record<string, string> = dateRangeToUtc(from, to);
    setLoading(true);
    api
      .get<ExpenseRow[]>(`/reports/expenses${buildQuery(params)}`)
      .then((res) => {
        if (!aborted) setRows(res);
      })
      .catch((err) => {
        if (!aborted)
          addAlert(
            "error",
            getErrorMessage(err, "Failed to load expenses report."),
          );
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [from, to, addAlert]);

  const totals = useMemo(() => {
    if (!rows) return { quantity: 0, amount: 0, remainingBalance: 0, total: 0 };
    return rows.reduce(
      (acc, r) => ({
        quantity: acc.quantity + r.quantity,
        amount: acc.amount + r.amount,
        remainingBalance: acc.remainingBalance + r.remainingBalance,
        total: acc.total + r.total,
      }),
      { quantity: 0, amount: 0, remainingBalance: 0, total: 0 },
    );
  }, [rows]);

  return (
    <>
      <div className="rounded-lg border bg-muted/30 p-3 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <DateField label="From" value={from} onChange={setFrom} max={to} />
          <DateField label="To" value={to} onChange={setTo} min={from} />
          <div className="w-full sm:ml-auto sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPdf}
              disabled={pdfLoading}
              className="w-full sm:w-auto"
            >
              <Printer className="size-4" />
              {pdfLoading ? "Loading…" : "Print"}
            </Button>
          </div>
        </div>
      </div>

      <PrintableSheet
        title="Expenses Report"
        subtitle={`${formatDate(from)} — ${formatDate(to)}`}
      >
        {loading ? (
          <Loading />
        ) : !rows || rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No expenses in this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-foreground/80">
                  <th className="w-28 px-3 py-2 text-left font-semibold">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Supplier
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Description
                  </th>
                  <th className="w-16 px-3 py-2 text-right font-semibold">
                    Qty
                  </th>
                  <th className="w-28 px-3 py-2 text-right font-semibold">
                    Amt/Unit
                  </th>
                  <th className="w-28 px-3 py-2 text-right font-semibold">
                    Amount
                  </th>
                  <th className="w-28 px-3 py-2 text-right font-semibold">
                    Remaining
                  </th>
                  <th className="w-28 px-3 py-2 text-right font-semibold">
                    Total
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-b border-foreground/10">
                    <td className="px-3 py-2 tabular-nums">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-3 py-2">{r.supplier}</td>
                    <td className="px-3 py-2">{r.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(r.amountPerUnit)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(r.amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(r.remainingBalance)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(r.total)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.notes || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/80 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totals.quantity}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(totals.amount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(totals.remainingBalance)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(totals.total)}
                  </td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </PrintableSheet>
    </>
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
    <div className="w-full space-y-1.5 sm:w-auto">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <DatePicker
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        className="w-full sm:w-40"
        required
      />
    </div>
  );
}

function PrintableSheet({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background shadow-xs print:rounded-none print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-4 sm:px-6 print:px-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {subtitle}
          </p>
        )}
      </div>
      <div className="px-2 py-2 print:px-0">{children}</div>
    </div>
  );
}
