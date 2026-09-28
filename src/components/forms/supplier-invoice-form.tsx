import { useState, useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import { ProductForm } from "./product-form";
import { SupplierForm } from "./supplier-form";
import { usePermissions } from "@/hooks/use-permissions";

type ItemDraft = {
  itemId: string;
  unitPrice: number | null;
  quantity: string;
  amount: string;
  notes: string;
};

const blankItem = (): ItemDraft => ({
  itemId: "",
  unitPrice: null,
  quantity: "1",
  amount: "",
  notes: "",
});

type SupplierInvoiceFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultSupplierId?: string;
  defaultSupplierLabel?: string;
};

export function SupplierInvoiceForm({
  open,
  ...props
}: SupplierInvoiceFormProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="New Supplier Invoice">
      <SupplierInvoiceFormBody {...props} />
    </Modal>
  );
}

function SupplierInvoiceFormBody({
  onClose,
  onSaved,
  defaultSupplierId,
  defaultSupplierLabel,
}: Omit<SupplierInvoiceFormProps, "open">) {
  const itemsLabelId = useId();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceNumberAuto, setInvoiceNumberAuto] = useState(true);
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [submitting, setSubmitting] = useState(false);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, ...patch };
        if ("quantity" in patch && updated.unitPrice != null) {
          const qty = Number(updated.quantity) || 0;
          updated.amount = String(round2(updated.unitPrice * qty));
        }
        return updated;
      }),
    );
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const itemTotal = (item: ItemDraft) =>
    (Number(item.amount) || 0) * (Number(item.quantity) || 0);

  const total = items.reduce((s, it) => s + itemTotal(it), 0);

  const canSubmit =
    supplierId &&
    (invoiceNumberAuto || Number(invoiceNumber) > 0) &&
    items.length > 0 &&
    items.every((it) => it.itemId && Number(it.quantity) > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/supplier-invoices", {
        ...(invoiceNumberAuto
          ? {}
          : { invoiceNumber: Number(invoiceNumber) }),
        supplierId,
        notes: notes || undefined,
        items: items.map((it) => ({
          itemType: "product",
          itemId: it.itemId,
          quantity: Number(it.quantity) || 0,
          amount: round2((Number(it.amount) || 0) * (Number(it.quantity) || 0)),
          notes: it.notes || "",
        })),
      });
      addAlert("success", "Supplier invoice created.");
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
      <FormField
        label="Invoice Number"
        required
        actions={
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={invoiceNumberAuto}
              onCheckedChange={(value) => {
                const next = Boolean(value);
                setInvoiceNumberAuto(next);
                if (next) setInvoiceNumber("");
              }}
            />
            <span>Auto</span>
          </label>
        }
      >
        {({ id }) => (
          <Input
            id={id}
            type="number"
            min="1"
            step="1"
            value={invoiceNumber}
            onChange={(e) =>
              setInvoiceNumber(clampNonNegative(e.target.value))
            }
            disabled={invoiceNumberAuto}
            placeholder={invoiceNumberAuto ? "Auto-generated" : ""}
          />
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-3">
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
      </div>

      <FormField label="Notes">
        {({ id }) => (
          <textarea
            id={id}
            className={textareaClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </FormField>

      <div className="space-y-2" role="group" aria-labelledby={itemsLabelId}>
        <div className="flex items-center justify-between">
          <label id={itemsLabelId} className="text-sm font-medium">Items *</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, blankItem()])}
          >
            <Plus className="size-3.5 mr-1" /> Add Item
          </Button>
        </div>

        {items.map((item, idx) => (
          <div
            key={idx}
            className="rounded-md border border-border p-3 space-y-2"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <FormField
                label="Product"
                required
                size="muted"
                className="space-y-1"
              >
                {({ id }) => (
                  <SearchableDropdown
                    id={id}
                    value={item.itemId}
                    onChange={(v) => updateItem(idx, { itemId: v })}
                    apiEndpoint="/products/dropdown"
                    mapItem={(p: { id: string; name: string }) => ({
                      value: p.id,
                      label: p.name,
                    })}
                    placeholder="Select product…"
                    renderAddForm={
                      can("products:write")
                        ? ({ open, onClose, onCreated }) => (
                            <ProductForm
                              open={open}
                              onClose={onClose}
                              onSaved={(created) => {
                                if (created)
                                  onCreated(
                                    String(created.id),
                                    String(created.name),
                                  );
                              }}
                            />
                          )
                        : undefined
                    }
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                aria-label="Remove item"
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FormField
                label="Qty"
                required
                size="muted"
                className="space-y-1"
              >
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, {
                        quantity: clampNonNegative(e.target.value),
                      })
                    }
                  />
                )}
              </FormField>
              <FormField label="Amount" size="muted" className="space-y-1">
                {({ id }) => (
                  <>
                    <MoneyInput
                      id={id}
                      min="0"
                      value={item.amount}
                      onChange={(e) =>
                        updateItem(idx, {
                          amount: clampNonNegative(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Total: ${itemTotal(item).toFixed(2)}
                    </p>
                  </>
                )}
              </FormField>
              <FormField label="Notes" size="muted" className="space-y-1">
                {({ id }) => (
                  <Input
                    id={id}
                    value={item.notes}
                    onChange={(e) => updateItem(idx, { notes: e.target.value })}
                  />
                )}
              </FormField>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium">
          Total: ${total.toFixed(2)}
        </span>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Creating…" : "Create Invoice"}
          </Button>
        </div>
      </div>
    </form>
  );
}
