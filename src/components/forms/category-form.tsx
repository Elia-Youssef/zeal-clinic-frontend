import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { textareaClass } from "@/lib/form-styles";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ProductCategory } from "@/lib/types";

type CategoryFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: ProductCategory;
};

export function CategoryForm({ open, ...props }: CategoryFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Category" : "New Category"}
    >
      <CategoryFormBody {...props} />
    </Modal>
  );
}

function CategoryFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<CategoryFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [submitting, setSubmitting] = useState(false);

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
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>(
          "/product-categories",
          payload,
        );
        addAlert("success", "Category created.");
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
      <FormField label="Parent Category">
        {({ id }) => (
          <SearchableDropdown
            id={id}
            value={parentId}
            onChange={setParentId}
            apiEndpoint="/product-categories/dropdown"
            mapItem={(c: { id: string; name: string }) => ({ value: c.id, label: c.name })}
            placeholder="None (top-level)"
            renderAddForm={({ open: addOpen, onClose: closeAdd, onCreated }) => (
              <CategoryForm
                open={addOpen}
                onClose={closeAdd}
                onSaved={(created) => {
                  if (created) {
                    onCreated(String(created.id), String(created.name));
                  }
                }}
              />
            )}
          />
        )}
      </FormField>
      <FormField label="Description">
        {({ id }) => (
          <textarea
            id={id}
            className={textareaClass}
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        )}
      </FormField>
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
