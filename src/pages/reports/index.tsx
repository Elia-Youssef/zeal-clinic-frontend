import { useState, type ReactNode } from "react";
import { ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs } from "@/components/shared/tabs";
import { FormField } from "@/components/shared/form-field";
import { Loading } from "@/components/shared/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePageTitle } from "@/hooks/use-page-title";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { cn, fieldValueId, getErrorMessage } from "@/lib/utils";
import {
  beirutDaysAgo,
  beirutToday,
  dateRangeToUtc,
  formatInBeirut,
} from "@/lib/tz";

const reportTabs = ["Revenue", "Expenses"];

type RevenueLevel =
  | "all"
  | "kind"
  | "procedure-type"
  | "procedure-category"
  | "product-category"
  | "procedure"
  | "product"
  | "other"
  | "discount";

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
};

type ExpensesResponse = {
  rows: ExpenseRow[];
  totals: { amount: number; remaining: number };
};

const levelOptions: {
  value: RevenueLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "all",
    label: "All items",
    description: "Every invoice line — procedures, products, and other.",
  },
  {
    value: "kind",
    label: "Item kind",
    description: "Totals per kind: procedure, product, and other.",
  },
  {
    value: "procedure-type",
    label: "Procedure type",
    description: "Procedure revenue grouped by procedure type.",
  },
  {
    value: "procedure-category",
    label: "Procedure category",
    description: "Procedure revenue grouped by procedure category.",
  },
  {
    value: "procedure",
    label: "Procedure",
    description: "Each individual procedure.",
  },
  {
    value: "product-category",
    label: "Product category",
    description: "Product revenue grouped by product category.",
  },
  {
    value: "product",
    label: "Product",
    description: "Each individual product.",
  },
  {
    value: "other",
    label: "Other items",
    description: "Only the custom “other” invoice lines.",
  },
  {
    value: "discount",
    label: "Discounts",
    description:
      "Money given away per discount. Gift cards are excluded — they credit patient balances, not invoices.",
  },
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
    case "all":
      return "Item";
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
    case "other":
      return "Item";
    case "discount":
      return "Discount";
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
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, loading } = useApiQuery(
    () => {
      const params: Record<string, string> = {
        ...dateRangeToUtc(from, to),
        level,
      };
      return api.get<RevenueResponse>(`/reports/revenue${buildQuery(params)}`);
    },
    [from, to, level],
    (err) =>
      addAlert("error", getErrorMessage(err, "Failed to load revenue report.")),
  );

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

  return (
    <>
      <div className="rounded-lg border bg-muted/30 p-3 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <DateField label="From" value={from} onChange={setFrom} max={to} />
          <DateField label="To" value={to} onChange={setTo} min={from} />
          <FormField label="Group by" size="small" className="w-full sm:w-56">
            {({ id }) => (
              <LevelSelect id={id} value={level} onChange={setLevel} />
            )}
          </FormField>
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
          <Table className="min-w-150">
            <TableHeader>
              <TableRow>
                <TableHead>{levelHeader(data.level)}</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Amount</TableHead>
                <TableHead className="w-20 text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it, idx) => (
                <TableRow key={`${it.entityId}-${idx}`}>
                  <TableCell className="whitespace-normal">
                    {it.entityName}
                    {!it.entityId && (
                      <span className="ml-1 text-muted-foreground">
                        (uncategorized)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(it.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.percentage.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {data.totals.quantity}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(data.totals.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">100.0</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </PrintableSheet>
    </>
  );
}

function ExpensesReport() {
  const { addAlert } = useAlertStore();
  const [from, setFrom] = useState(beirutDaysAgo(30));
  const [to, setTo] = useState(beirutToday());
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, loading } = useApiQuery(
    () =>
      api.get<ExpensesResponse>(
        `/reports/expenses${buildQuery(dateRangeToUtc(from, to))}`,
      ),
    [from, to],
    (err) =>
      addAlert(
        "error",
        getErrorMessage(err, "Failed to load expenses report."),
      ),
  );

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
        ) : !data || data.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No expenses in this range.
          </p>
        ) : (
          <Table className="min-w-175">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Amt/Unit</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-28 text-right">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="tabular-nums">
                    {formatDate(r.date)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {r.supplier}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {r.description}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(r.amountPerUnit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(r.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(r.remainingBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5}>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(data.totals.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(data.totals.remaining)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </PrintableSheet>
    </>
  );
}

function LevelSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: RevenueLevel;
  onChange: (value: RevenueLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = levelOptions.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-describedby={fieldValueId(id)}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      >
        <span id={fieldValueId(id)} className="truncate">
          {selected?.label ?? "Select"}
        </span>
        <ChevronDown className="ml-1 size-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-(--anchor-width) gap-0 p-1"
      >
        {levelOptions.map((opt) => (
          <Tooltip key={opt.value}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    opt.value === value && "bg-accent font-medium",
                  )}
                >
                  {opt.label}
                </button>
              }
            />
            <TooltipContent side="right" sideOffset={8} className="max-w-56">
              {opt.description}
            </TooltipContent>
          </Tooltip>
        ))}
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
    <FormField label={label} size="small" className="w-full sm:w-auto">
      {({ id }) => (
        <DatePicker
          id={id}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          className="w-full sm:w-40"
          required
        />
      )}
    </FormField>
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
      <div className="overflow-hidden rounded-b-lg print:rounded-none">
        {children}
      </div>
    </div>
  );
}
