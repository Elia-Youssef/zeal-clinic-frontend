import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
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
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(defaultSupplierId ?? "");
    setAmount("");
    setCurrencyId("");
    setTransactionMethod("cash");
    setDescription("");
  }, [open, defaultSupplierId]);

  const canSubmit = !!supplierId && Number(amount) > 0 && !!currencyId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post("/supplier-payments", {
        supplierId,
        amount: Number(amount),
        currencyId,
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
          <label className="text-sm font-medium">Supplier *</label>
          <SearchableDropdown
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
