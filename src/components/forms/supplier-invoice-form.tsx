import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { ProductForm } from "./product-form";
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

export function SupplierInvoiceForm({
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
  const [currencyId, setCurrencyId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(defaultSupplierId ?? "");
    setCurrencyId("");
    setNotes("");
    setItems([blankItem()]);
  }, [open, defaultSupplierId]);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, ...patch };
        if ("quantity" in patch && updated.unitPrice != null) {
          const qty = Number(updated.quantity) || 0;
          updated.amount = String(updated.unitPrice * qty);
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
    currencyId &&
    items.length > 0 &&
    items.every((it) => it.itemId && Number(it.quantity) > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/supplier-invoices", {
        supplierId,
        currencyId,
        notes: notes || undefined,
        items: items.map((it) => ({
          itemType: "product",
          itemId: it.itemId,
          quantity: Number(it.quantity) || 0,
          amount: (Number(it.amount) || 0) * (Number(it.quantity) || 0),
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
    <Modal open={open} onClose={onClose} title="New Supplier Invoice">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Items *</label>
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
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Product *
                  </label>
                  <SearchableDropdown
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
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Qty *</label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Amount
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.amount}
                    onChange={(e) =>
                      updateItem(idx, { amount: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Total: ${itemTotal(item).toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <Input
                    value={item.notes}
                    onChange={(e) => updateItem(idx, { notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total + Actions */}
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
    </Modal>
  );
}
