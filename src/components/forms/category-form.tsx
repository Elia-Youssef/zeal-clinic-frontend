
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { textareaClass } from "@/lib/form-styles";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ProductCategory } from "@/lib/types";

export function CategoryForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: ProductCategory;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [parentId, setParentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDesc(initial?.description ?? "");
    setParentId(initial?.parentId ?? "");
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name,
      description: isEdit ? desc : desc || undefined,
    };
    if (isEdit || parentId) payload.parentId = parentId;
    try {
      if (isEdit) {
        await api.put(`/product-categories/${initial.id}`, payload);
        addAlert("success", "Category updated.");
      } else {
        await api.post("/product-categories", payload);
        addAlert("success", "Category created.");
      }
      onSaved();
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
      title={isEdit ? "Edit Category" : "New Category"}
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
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Parent Category</label>
          <SearchableDropdown
            value={parentId}
            onChange={setParentId}
            apiEndpoint="/product-categories/dropdown"
            mapItem={(c: { id: string; name: string }) => ({ value: c.id, label: c.name })}
            placeholder="None (top-level)"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
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
