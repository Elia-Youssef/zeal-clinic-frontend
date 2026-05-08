import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { employeePaymentTypeOptions } from "@/lib/constants";

export function EmployeePaymentForm({
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

  const canSubmit = Number(amount) > 0 && !!currencyId && !!transactionMethod;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post("/employee-payments", {
        employeeId,
        amount: Number(amount),
        currencyId,
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
    <Modal open={open} onClose={onClose} title="Record Employee Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Amount *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
            <label className="text-sm font-medium">Type *</label>
            <SearchableDropdown
              value={transactionMethod}
              onChange={setTransactionMethod}
              options={employeePaymentTypeOptions}
              placeholder="Select type…"
              required
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
