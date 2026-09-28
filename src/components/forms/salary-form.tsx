import { useState } from "react";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/lib/form-styles";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { MoneyInput } from "@/components/shared/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";

type SalaryFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
};

export function SalaryForm({ open, ...props }: SalaryFormProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="Add Salary">
      <SalaryFormBody {...props} />
    </Modal>
  );
}

function SalaryFormBody({
  onClose,
  onSaved,
  employeeId,
}: Omit<SalaryFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Number(amount) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/employees/${employeeId}/salaries`, {
        amount: round2(Number(amount)),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Amount" required>
          {({ id }) => (
            <MoneyInput
              id={id}
              min="0"
              value={amount}
              onChange={(e) => setAmount(clampNonNegative(e.target.value))}
              required
            />
          )}
        </FormField>
        <FormField label="Effective Date">
          {({ id }) => (
            <DatePicker
              id={id}
              value={effectiveDate}
              onChange={setEffectiveDate}
            />
          )}
        </FormField>
        <FormField label="Notes">
          {({ id }) => (
            <textarea
              id={id}
              className={textareaClass}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </FormField>
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
  );
}
