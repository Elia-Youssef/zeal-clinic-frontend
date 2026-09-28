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
import type { BalanceTransaction, ClientRefundRequest } from "@/lib/types";
import { PatientForm } from "./patient-form";
import { usePermissions } from "@/hooks/use-permissions";

type ClientRefundFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (transaction: BalanceTransaction) => void;
  defaultPatientId?: string;
  defaultPatientLabel?: string;
  defaultAmount?: number;
};

export function ClientRefundForm({ open, ...props }: ClientRefundFormProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="New Client Refund">
      <ClientRefundFormBody {...props} />
    </Modal>
  );
}

function ClientRefundFormBody({
  onClose,
  onSaved,
  defaultPatientId,
  defaultPatientLabel,
  defaultAmount,
}: Omit<ClientRefundFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [amount, setAmount] = useState(
    defaultAmount != null ? String(defaultAmount) : "",
  );
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Patient" required>
        {({ id }) => (
          <SearchableDropdown
            id={id}
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
        )}
      </FormField>

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
          {submitting ? "Recording…" : "Record Refund"}
        </Button>
      </div>
    </form>
  );
}
