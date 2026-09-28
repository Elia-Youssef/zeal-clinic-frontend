import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ProcedureCategory } from "@/lib/types";

type ProcedureCategoryFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: ProcedureCategory;
};

export function ProcedureCategoryForm({
  open,
  ...props
}: ProcedureCategoryFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal open={open} onClose={props.onClose} title={isEdit ? "Edit Procedure Category" : "New Procedure Category"}>
      <ProcedureCategoryFormBody {...props} />
    </Modal>
  );
}

function ProcedureCategoryFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<ProcedureCategoryFormProps, "open">) {
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
        await api.put(`/procedure-categories/${initial.id}`, payload);
        addAlert("success", "Category updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>(
          "/procedure-categories",
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
          <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required />
        )}
      </FormField>
      <FormField label="Parent Category">
        {({ id }) => (
          <SearchableDropdown
            id={id}
            value={parentId}
            onChange={setParentId}
            defaultApiOption={
              initial?.parentId && initial?.parent?.name
                ? { value: initial.parentId, label: initial.parent.name }
                : undefined
            }
            apiEndpoint="/procedure-categories/dropdown"
            mapItem={(c: { id: string; name: string }) => ({
              value: c.id,
              label: c.name,
            })}
            placeholder="None (top-level)"
            renderAddForm={({ open: addOpen, onClose: closeAdd, onCreated }) => (
              <ProcedureCategoryForm
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
          <textarea id={id} className={textareaClass} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        )}
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
