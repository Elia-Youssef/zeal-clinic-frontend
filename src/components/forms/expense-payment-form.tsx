import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { transactionMethodOptions } from "@/lib/constants";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative } from "@/lib/utils";
import type { BalanceTransaction } from "@/lib/types";

export function ExpensePaymentForm({
  open,
  expenseId,
  onClose,
  onSaved,
}: {
  open: boolean;
  expenseId: string;
  onClose: () => void;
  onSaved: (transaction: BalanceTransaction) => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setCurrencyId("");
    setTransactionMethod("cash");
    setDescription("");
  }, [open]);

  const canSubmit = Number(amount) > 0 && !!currencyId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const transaction = await api.post<BalanceTransaction>(
        "/expense-payments",
        {
          amount: Number(amount),
          currencyId,
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
    <Modal open={open} onClose={onClose} title="New Expense Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <label className="text-sm font-medium">Method</label>
            <SearchableDropdown
              value={transactionMethod}
              onChange={setTransactionMethod}
              options={transactionMethodOptions}
              placeholder="Select method…"
              defaultFirst
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Recording…" : "Record Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
