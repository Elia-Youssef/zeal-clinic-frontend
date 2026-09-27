import { useState, useId } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { transactionMethodOptions } from "@/lib/constants";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import type { BalanceTransaction, ClientRefundRequest } from "@/lib/types";
import { PatientForm } from "./patient-form";
import { usePermissions } from "@/hooks/use-permissions";

export function ClientRefundForm({
  open,
  onClose,
  onSaved,
  defaultPatientId,
  defaultPatientLabel,
  defaultAmount,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (transaction: BalanceTransaction) => void;
  defaultPatientId?: string;
  defaultPatientLabel?: string;
  defaultAmount?: number;
}) {
  const fieldId = useId();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useAdjustOnChange([open, defaultPatientId, defaultAmount], () => {
    if (!open) return;
    setPatientId(defaultPatientId ?? "");
    setAmount(defaultAmount != null ? String(defaultAmount) : "");
    setTransactionMethod("cash");
    setDescription("");
  });

  const canSubmit = !!patientId && Number(amount) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: ClientRefundRequest = {
        patientId,
        amount: round2(Number(amount)),
        transactionMethod: transactionMethod || undefined,
        description: description.trim() || undefined,
      };
      const transaction = await api.post<BalanceTransaction>(
        "/client-refunds",
        payload,
      );
      addAlert("success", "Refund recorded.");
      onSaved(transaction);
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Client Refund">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-patient`} className="text-sm font-medium">Patient *</label>
          <SearchableDropdown
            id={`${fieldId}-patient`}
            value={patientId}
            onChange={setPatientId}
            defaultApiOption={
              defaultPatientId && defaultPatientLabel
                ? { value: defaultPatientId, label: defaultPatientLabel }
                : undefined
            }
            apiEndpoint="/patients/dropdown"
            mapItem={(p: { id: string; name: string }) => ({
              value: p.id,
              label: p.name,
            })}
            placeholder="Select patient…"
            required
            renderAddForm={
              can("patients:write")
                ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                    <PatientForm
                      open={addOpen}
                      onClose={closeAdd}
                      onSaved={(created) => {
                        if (created) {
                          onCreated(
                            String(created.id),
                            `${created.firstName ?? ""} ${
                              created.lastName ?? ""
                            }`.trim(),
                          );
                        }
                      }}
                    />
                  )
                : undefined
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-amount`} className="text-sm font-medium">Amount *</label>
            <MoneyInput
              id={`${fieldId}-amount`}
              min="0"
              value={amount}
              onChange={(e) => setAmount(clampNonNegative(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-method`} className="text-sm font-medium">Method</label>
            <SearchableDropdown
              id={`${fieldId}-method`}
              value={transactionMethod}
              onChange={setTransactionMethod}
              options={transactionMethodOptions}
              placeholder="Select method…"
              defaultFirst
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-description`} className="text-sm font-medium">Description</label>
          <textarea
            id={`${fieldId}-description`}
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
            {submitting ? "Recording…" : "Record Refund"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
