
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { transactionTypeOptions } from "@/lib/constants";

export function TransactionForm({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);

  const [fromBalanceId, setFromBalanceId] = useState("");
  const [toBalanceId, setToBalanceId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [transactionType, setTransactionType] = useState("transfer");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromBalanceId("");
    setToBalanceId("");
    setAmount("");
    setCurrencyId("");
    setTransactionType("transfer");
    setDescription("");
  }, [open]);

  const canSubmit = fromBalanceId && toBalanceId && Number(amount) > 0 && currencyId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/transactions", {
        fromBalanceId,
        toBalanceId,
        amount: Number(amount),
        currencyId,
        transactionType,
        description: description || undefined,
      });
      addAlert("success", "Transaction created.");
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">From Balance *</label>
            <SearchableDropdown
              value={fromBalanceId}
              onChange={setFromBalanceId}
              apiEndpoint="/balances"
              mapItem={(b: { id: string; entityName: string; entityType: string }) => ({ value: b.id, label: `${b.entityName} (${b.entityType})` })}
              placeholder="Select from…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">To Balance *</label>
            <SearchableDropdown
              value={toBalanceId}
              onChange={setToBalanceId}
              apiEndpoint="/balances"
              mapItem={(b: { id: string; entityName: string; entityType: string }) => ({ value: b.id, label: `${b.entityName} (${b.entityType})` })}
              placeholder="Select to…"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Amount *</label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Currency *</label>
            <SearchableDropdown
              value={currencyId}
              onChange={setCurrencyId}
              apiEndpoint="/currencies/dropdown"
              mapItem={(c: { id: string; name: string }) => ({ value: c.id, label: c.name })}
              placeholder="Select currency…"
              required
              defaultFirst
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type *</label>
            <SearchableDropdown
              value={transactionType}
              onChange={setTransactionType}
              options={transactionTypeOptions}
              placeholder="Select type…"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea className={textareaClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Creating…" : "Create Transaction"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
