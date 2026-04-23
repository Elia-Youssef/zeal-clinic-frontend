"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { SearchableDropdown } from "@/components/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { transactionTypeOptions } from "@/lib/constants";

export function BalanceAdjustmentForm({
  open,
  onClose,
  onSaved,
  mode = "adjustment",
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  mode?: "adjustment" | "write-off";
}) {
  const addAlert = useAlertStore((s) => s.addAlert);

  const [fromBalanceId, setFromBalanceId] = useState("");
  const [toBalanceId, setToBalanceId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromBalanceId("");
    setToBalanceId("");
    setAmount("");
    setCurrencyId("");
    setTransactionMethod("cash");
    setDescription("");
  }, [open]);

  const isWriteOff = mode === "write-off";
  const canSubmit = fromBalanceId && toBalanceId && Number(amount) > 0 && description;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = isWriteOff ? "/balance-write-offs" : "/balance-adjustments";
      const payload: Record<string, unknown> = {
        fromBalanceId,
        toBalanceId,
        amount: Number(amount),
        description,
      };
      if (currencyId) payload.currencyId = currencyId;
      if (!isWriteOff && transactionMethod) payload.transactionMethod = transactionMethod;

      await api.post(endpoint, payload);
      addAlert("success", isWriteOff ? "Write-off created." : "Adjustment created.");
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isWriteOff ? "New Write-Off" : "New Balance Adjustment"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">From Balance *</label>
            <SearchableDropdown
              value={fromBalanceId}
              onChange={setFromBalanceId}
              apiEndpoint="/balances"
              mapItem={(b: { id: string; entityName: string; entityType: string }) => ({
                value: b.id,
                label: `${b.entityName} (${b.entityType})`,
              })}
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
              mapItem={(b: { id: string; entityName: string; entityType: string }) => ({
                value: b.id,
                label: `${b.entityName} (${b.entityType})`,
              })}
              placeholder="Select to…"
              required
            />
          </div>
        </div>

        <div className={`grid ${isWriteOff ? "grid-cols-2" : "grid-cols-3"} gap-3`}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Amount *</label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Currency</label>
            <SearchableDropdown
              value={currencyId}
              onChange={setCurrencyId}
              apiEndpoint="/currencies/dropdown"
              mapItem={(c: { id: string; name: string }) => ({ value: c.id, label: c.name })}
              placeholder="Select currency…"
              defaultFirst
            />
          </div>
          {!isWriteOff && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Method</label>
              <SearchableDropdown
                value={transactionMethod}
                onChange={setTransactionMethod}
                options={transactionTypeOptions}
                placeholder="Select method…"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description *</label>
          <textarea className={textareaClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Creating…" : isWriteOff ? "Create Write-Off" : "Create Adjustment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
