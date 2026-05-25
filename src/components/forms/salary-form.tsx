
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { textareaClass } from "@/lib/form-styles";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative } from "@/lib/utils";

export function SalaryForm({
  open,
  onClose,
  onSaved,
  employeeId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setCurrencyId("");
    setEffectiveDate("");
    setNotes("");
  }, [open]);

  const canSubmit = Number(amount) > 0 && !!currencyId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/employees/${employeeId}/salaries`, {
        amount: Number(amount),
        currencyId,
        effectiveDate: effectiveDate || undefined,
        notes: notes || undefined,
      });
      addAlert("success", "Salary added.");
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Salary">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Amount *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(clampNonNegative(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Currency *</label>
            <SearchableDropdown
              value={currencyId}
              onChange={setCurrencyId}
              apiEndpoint="/currencies/dropdown"
              mapItem={(c: { id: string; name: string }) => ({
                value: c.id,
                label: c.name,
              })}
              placeholder="Select currency…"
              required
              defaultFirst
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Effective Date</label>
            <DatePicker
              value={effectiveDate}
              onChange={setEffectiveDate}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className={textareaClass}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Adding…" : "Add Salary"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
