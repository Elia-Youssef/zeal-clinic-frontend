"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { discountItemTypeOptions } from "@/lib/constants";

export function DiscountItemForm({
  open,
  onClose,
  onSaved,
  discountId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  discountId: string;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [itemType, setItemType] = useState("procedure");
  const [itemId, setItemId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItemType("procedure");
    setItemId("");
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    setSubmitting(true);
    try {
      await api.post(`/discounts/${discountId}/items`, { itemType, itemId });
      addAlert("success", "Item linked.");
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Item">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Type *</label>
          <SearchableDropdown
            value={itemType}
            onChange={(v) => {
              setItemType(v);
              setItemId("");
            }}
            options={discountItemTypeOptions}
            placeholder="Type…"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {itemType === "procedure" ? "Procedure" : "Product"} *
          </label>
          {itemType === "procedure" ? (
            <SearchableDropdown
              value={itemId}
              onChange={setItemId}
              apiEndpoint="/procedures/dropdown"
              mapItem={(p: { id: string; name: string }) => ({
                value: p.id,
                label: p.name,
              })}
              placeholder="Select procedure…"
            />
          ) : (
            <SearchableDropdown
              value={itemId}
              onChange={setItemId}
              apiEndpoint="/products/dropdown"
              mapItem={(p: { id: string; name: string }) => ({
                value: p.id,
                label: p.name,
              })}
              placeholder="Select product…"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !itemId}>
            {submitting ? "Saving…" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
