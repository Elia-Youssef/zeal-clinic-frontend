import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { MoneyInput } from "@/components/shared/money-input";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";
import type { SalaryPreparation } from "@/lib/types";

export function SalaryAdjustmentForm({
  open,
  onClose,
  onSaved,
  preparation,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  preparation: SalaryPreparation | null;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [adjustment, setAdjustment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !preparation) return;
    setAdjustment(preparation.adjustment?.toString() ?? "0");
  }, [open, preparation]);

  if (!preparation) return null;

  const parsedAdjustment = Number(adjustment);
  const adjustmentValid =
    adjustment.trim() !== "" && !Number.isNaN(parsedAdjustment);
  const newPrepared = adjustmentValid
    ? preparation.baseSalary + parsedAdjustment
    : preparation.baseSalary;
  const wouldGoNegative = adjustmentValid && newPrepared < 0;
  const unchanged =
    adjustmentValid && parsedAdjustment === preparation.adjustment;
  const canSubmit = adjustmentValid && !wouldGoNegative && !unchanged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.patch(`/employee-salary-preparations/${preparation.id}`, {
        adjustment: parsedAdjustment,
      });
      addAlert("success", "Adjustment updated.");
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Adjustment"
      description="Positive values add to the prepared amount, negative values deduct from it."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm">
          <div className="col-span-full">
            <span className="text-muted-foreground">Period: </span>
            {beirutDayKey(preparation.periodStart)} →{" "}
            {beirutDayKey(preparation.periodEnd)}
          </div>
          <div>
            <span className="text-muted-foreground">Base: </span>
            <span className="font-medium">
              ${preparation.baseSalary.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">New prepared: </span>
            <span
              className={`font-medium ${wouldGoNegative ? "text-destructive" : ""}`}
            >
              ${newPrepared.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Adjustment *</label>
          <MoneyInput
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="e.g. 100 or -50"
            required
          />
          {wouldGoNegative && (
            <p className="text-xs text-destructive">
              Adjustment would make prepared amount negative.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
