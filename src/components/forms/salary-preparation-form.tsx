
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Loading } from "@/components/shared/loading";
import {
  DataTable,
  type Column,
} from "@/components/data/data-table";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { beirutNow } from "@/lib/tz";
import type { SalaryPreparation } from "@/lib/types";

export function SalaryPreparationForm({
  open,
  onClose,
  onPrepared,
}: {
  open: boolean;
  onClose: () => void;
  onPrepared?: (preps: SalaryPreparation[]) => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SalaryPreparation[] | null>(null);

  useEffect(() => {
    if (!open) return;
    // Default to previous calendar month, anchored on Beirut so the month
    // doesn't flip for a clinic user opening the form from a different zone.
    const today = beirutNow();
    const firstOfThisMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    const firstOfPrevMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    );
    const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 86400000);
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    setPeriodStart(fmt(firstOfPrevMonth));
    setPeriodEnd(fmt(lastOfPrevMonth));
    setNotes("");
    setResult(null);
  }, [open]);

  const canSubmit = !!periodStart && !!periodEnd && !result;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const preps = await api.post<SalaryPreparation[]>(
        "/employee-salaries/prepare",
        {
          periodStart,
          periodEnd,
          ...(notes ? { notes } : {}),
        },
      );
      setResult(preps);
      const count = preps?.length ?? 0;
      addAlert(
        "success",
        `Prepared salaries for ${count} employee${count === 1 ? "" : "s"}.`,
      );
      onPrepared?.(preps);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const itemColumns: Column<SalaryPreparation>[] = [
    {
      key: "employee",
      header: "Employee",
      className: "truncate",
      render: (i) => (
        <span className="font-medium">{i.employeeName ?? i.employeeId}</span>
      ),
    },
    {
      key: "base",
      header: "Base",
      className: "w-28",
      render: (i) => i.baseSalary?.toFixed(2) ?? "---",
    },
    {
      key: "adjustment",
      header: "Adjustment",
      className: "w-32",
      render: (i) =>
        i.adjustment != null ? (
          <span
            className={
              i.adjustment > 0
                ? "text-emerald-600"
                : i.adjustment < 0
                  ? "text-red-600"
                  : "text-muted-foreground"
            }
          >
            {i.adjustment > 0 ? "+" : ""}
            {i.adjustment.toFixed(2)}
          </span>
        ) : (
          "---"
        ),
    },
    {
      key: "amount",
      header: "Prepared",
      className: "w-32",
      render: (i) => (
        <span className="font-medium">{i.preparedAmount?.toFixed(2)}</span>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Prepare Salaries"
      description={
        result
          ? "Salaries posted successfully."
          : "Posts a transaction per employee with an active salary for the chosen period."
      }
    >
      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Period Start *</label>
              <DatePicker
                value={periodStart}
                onChange={setPeriodStart}
                required
                max={periodEnd}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Period End *</label>
              <DatePicker
                value={periodEnd}
                onChange={setPeriodEnd}
                required
                min={periodStart}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {submitting && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <Loading />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Posting transactions…
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? "Preparing…" : "Prepare"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Period: </span>
              {periodStart} → {periodEnd}
            </div>
            {notes && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Notes: </span>
                {notes}
              </div>
            )}
          </div>

          {result.length ? (
            <div className="rounded-md border border-border">
              <DataTable
                columns={itemColumns}
                data={result}
                rowKey={(i) => i.id}
              />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No employees with active salaries were found in this period.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
