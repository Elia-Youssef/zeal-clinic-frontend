import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { transactionMethodOptions } from "@/lib/constants";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import type { BalanceTransaction } from "@/lib/types";

type ExpensePaymentFormProps = {
  open: boolean;
  expenseId: string;
  onClose: () => void;
  onSaved: (transaction: BalanceTransaction) => void;
};

export function ExpensePaymentForm({
  open,
  ...props
}: ExpensePaymentFormProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="New Expense Payment">
      <ExpensePaymentFormBody {...props} />
    </Modal>
  );
}

function ExpensePaymentFormBody({
  expenseId,
  onClose,
  onSaved,
}: Omit<ExpensePaymentFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [amount, setAmount] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Number(amount) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const transaction = await api.post<BalanceTransaction>(
        "/expense-payments",
        {
          amount: round2(Number(amount)),
          transactionMethod,
          description: description.trim(),
          expenseId,
        },
      );
      addAlert("success", "Expense payment recorded.");
      onSaved(transaction);
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
        <FormField label="Method">
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={transactionMethod}
              onChange={setTransactionMethod}
              options={transactionMethodOptions}
              placeholder="Select method…"
              defaultFirst
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
