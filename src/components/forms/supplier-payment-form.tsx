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
import { transactionMethodOptions } from "@/lib/constants";
import { SupplierForm } from "./supplier-form";
import { usePermissions } from "@/hooks/use-permissions";

type SupplierPaymentFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultSupplierId?: string;
  defaultSupplierLabel?: string;
};

export function SupplierPaymentForm({
  open,
  ...props
}: SupplierPaymentFormProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="New Supplier Payment">
      <SupplierPaymentFormBody {...props} />
    </Modal>
  );
}

function SupplierPaymentFormBody({
  onClose,
  onSaved,
  defaultSupplierId,
  defaultSupplierLabel,
}: Omit<SupplierPaymentFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "");
  const [amount, setAmount] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!supplierId && Number(amount) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post("/supplier-payments", {
        supplierId,
        amount: round2(Number(amount)),
        transactionMethod,
        description: description || "",
      });
      addAlert("success", "Supplier payment recorded.");
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
      <FormField label="Supplier" required>
        {({ id }) => (
          <SearchableDropdown
            id={id}
            value={supplierId}
            onChange={setSupplierId}
            defaultApiOption={
              defaultSupplierId && defaultSupplierLabel
                ? { value: defaultSupplierId, label: defaultSupplierLabel }
                : undefined
            }
            apiEndpoint="/suppliers/dropdown"
            mapItem={(s: { id: string; name: string }) => ({
              value: s.id,
              label: s.name,
            })}
            placeholder="Select supplier…"
            required
            renderAddForm={
              can("suppliers:write")
                ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                    <SupplierForm
                      open={addOpen}
                      onClose={closeAdd}
                      onSaved={(created) => {
                        if (created) {
                          onCreated(String(created.id), String(created.name));
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
          {submitting ? "Recording…" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
