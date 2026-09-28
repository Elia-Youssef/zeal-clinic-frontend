import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import { employeePaymentTypeOptions } from "@/lib/constants";

type EmployeePaymentFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
};

export function EmployeePaymentForm({
  open,
  ...props
}: EmployeePaymentFormProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="Record Employee Payment">
      <EmployeePaymentFormBody {...props} />
    </Modal>
  );
}

function EmployeePaymentFormBody({
  onClose,
  onSaved,
  employeeId,
}: Omit<EmployeePaymentFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);

  const [amount, setAmount] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Number(amount) > 0 && !!transactionMethod;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post("/employee-payments", {
        employeeId,
        amount: round2(Number(amount)),
        transactionMethod,
        description: description || undefined,
      });
      addAlert("success", "Employee payment recorded.");
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
        <FormField label="Type" required>
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={transactionMethod}
              onChange={setTransactionMethod}
              options={employeePaymentTypeOptions}
              placeholder="Select type…"
              required
            />
          )}
        </FormField>
      </div>

      <FormField label="Description">
        {({ id }) => (
          <textarea
            id={id}
            className={textareaClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? "Recording…" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
