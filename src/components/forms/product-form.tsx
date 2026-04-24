"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function ProductForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Product;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setCategoryId(initial?.categoryId ?? "");
    setQuantity(initial?.quantity?.toString() ?? "");
    setMinThreshold(initial?.minThreshold?.toString() ?? "");
    setUnitPrice(initial?.unitPrice?.toString() ?? "");
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name,
      unitPrice: Number(unitPrice),
    };
    if (categoryId) payload.categoryId = categoryId;
    if (quantity) payload.quantity = Number(quantity);
    if (minThreshold) payload.minThreshold = Number(minThreshold);

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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Product" : "New Product"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <SearchableDropdown
              value={categoryId}
              onChange={setCategoryId}
              apiEndpoint="/product-categories/dropdown"
              mapItem={(c: { id: string; name: string }) => ({ value: c.id, label: c.name })}
              placeholder="Select category…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Unit Price *</label>
            <Input
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Quantity</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Min Threshold</label>
            <Input
              type="number"
              value={minThreshold}
              onChange={(e) => setMinThreshold(e.target.value)}
            />
          </div>
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
    </Modal>
  );
}
