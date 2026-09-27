import { useState, useId } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import { transactionMethodOptions } from "@/lib/constants";
import { SupplierForm } from "./supplier-form";
import { usePermissions } from "@/hooks/use-permissions";

export function SupplierPaymentForm({
  open,
  onClose,
  onSaved,
  defaultSupplierId,
  defaultSupplierLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultSupplierId?: string;
  defaultSupplierLabel?: string;
}) {
  const fieldId = useId();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useAdjustOnChange([open, defaultSupplierId], () => {
    if (!open) return;
    setSupplierId(defaultSupplierId ?? "");
    setAmount("");
    setTransactionMethod("cash");
    setDescription("");
  });

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
    <Modal open={open} onClose={onClose} title="New Supplier Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-supplier`} className="text-sm font-medium">Supplier *</label>
          <SearchableDropdown
            id={`${fieldId}-supplier`}
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
            {submitting ? "Recording…" : "Record Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
