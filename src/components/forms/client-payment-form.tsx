
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
import type { Transaction } from "@/lib/types";

export function ClientPaymentForm({
  open,
  onClose,
  onSaved,
  defaultPatientId,
  defaultPatientLabel,
  defaultAmount,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultPatientId?: string;
  defaultPatientLabel?: string;
  defaultAmount?: number;
}) {
  return (
    <Modal open={open} onClose={onClose} title="New Client Payment">
      <ClientPaymentFormBody
        open={open}
        defaultPatientId={defaultPatientId}
        defaultPatientLabel={defaultPatientLabel}
        defaultAmount={defaultAmount}
        onSubmitted={() => {
          onSaved();
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}

export function ClientPaymentFormBody({
  open,
  defaultPatientId,
  defaultPatientLabel,
  defaultAmount,
  submitLabel = "Record Payment",
  cancelLabel = "Cancel",
  onSubmitted,
  onCancel,
}: {
  open: boolean;
  defaultPatientId?: string;
  defaultPatientLabel?: string;
  defaultAmount?: number;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmitted: (payment: Transaction) => void;
  onCancel: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);

  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState(
    defaultAmount != null ? String(defaultAmount) : "",
  );
  const [currencyId, setCurrencyId] = useState("");
  const [transactionType, setTransactionType] = useState("payment");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatientId(defaultPatientId ?? "");
    setAmount(defaultAmount != null ? String(defaultAmount) : "");
    setCurrencyId("");
    setTransactionType("payment");
    setDescription("");
  }, [open]);

  const canSubmit = patientId && Number(amount) > 0 && currencyId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await api.post<Transaction>("/client-payments", {
        patientId,
        amount: Number(amount),
        currencyId,
        transactionType,
        description: description || undefined,
      });
      addAlert("success", "Client payment recorded.");
      onSubmitted(created);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Patient *</label>
        <SearchableDropdown
          value={patientId}
          onChange={setPatientId}
          defaultApiOption={
            defaultPatientId && defaultPatientLabel
              ? { value: defaultPatientId, label: defaultPatientLabel }
              : undefined
          }
          apiEndpoint="/patients/dropdown"
          mapItem={(p: { id: string; name: string }) => ({ value: p.id, label: p.name })}
          placeholder="Select patient…"
          required
        />
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
          <label className="text-sm font-medium">Transaction Type</label>
          <SearchableDropdown
            value={transactionType}
            onChange={setTransactionType}
            options={transactionTypeOptions}
            placeholder="Select type…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Description</label>
        <textarea className={textareaClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? "Recording…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
