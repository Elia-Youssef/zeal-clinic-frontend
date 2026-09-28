import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { CategoryForm } from "./category-form";
import { usePermissions } from "@/hooks/use-permissions";

type ProductFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Product;
};

export function ProductForm({ open, ...props }: ProductFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Product" : "New Product"}
    >
      <ProductFormBody {...props} />
    </Modal>
  );
}

function ProductFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<ProductFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [quantity, setQuantity] = useState(
    initial?.quantity?.toString() ?? "",
  );
  const [minThreshold, setMinThreshold] = useState(
    initial?.minThreshold?.toString() ?? "",
  );
  const [unitPrice, setUnitPrice] = useState(
    initial?.unitPrice?.toString() ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name,
      unitPrice: round2(Number(unitPrice)),
    };
    if (isEdit || categoryId) payload.categoryId = categoryId;
    if (isEdit || quantity) payload.quantity = quantity ? Number(quantity) : 0;
    if (isEdit || minThreshold)
      payload.minThreshold = minThreshold ? Number(minThreshold) : 0;

    try {
      if (isEdit) {
        await api.put(`/products/${initial.id}`, payload);
        addAlert("success", "Product updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>("/products", payload);
        addAlert("success", "Product created.");
        onSaved(created);
      }
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Name" required>
        {({ id }) => (
          <Input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Category">
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={categoryId}
              onChange={setCategoryId}
              apiEndpoint="/product-categories/dropdown"
              mapItem={(c: { id: string; name: string }) => ({ value: c.id, label: c.name })}
              placeholder="Select category…"
              renderAddForm={
                can("product-categories:write")
                  ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                      <CategoryForm
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
        <FormField label="Unit Price" required>
          {({ id }) => (
            <MoneyInput
              id={id}
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(clampNonNegative(e.target.value))}
              required
            />
          )}
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Quantity">
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(clampNonNegative(e.target.value))}
            />
          )}
        </FormField>
        <FormField label="Min Threshold">
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min="0"
              value={minThreshold}
              onChange={(e) => setMinThreshold(clampNonNegative(e.target.value))}
            />
          )}
        </FormField>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
