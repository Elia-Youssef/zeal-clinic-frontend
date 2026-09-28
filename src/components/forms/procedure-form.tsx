import { useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import type { Procedure } from "@/lib/types";
import { ProcedureTypeForm } from "./procedure-type-form";
import { ProcedureCategoryForm } from "./procedure-category-form";
import { usePermissions } from "@/hooks/use-permissions";

type ProcedureFormFields = {
  name: string;
  typeId: string;
  typeName?: string;
  categoryId: string;
  categoryName?: string;
  price: string;
  priceNote: string;
  isActive: boolean;
  remarks: string;
  includes: string;
};

const emptyForm: ProcedureFormFields = {
  name: "",
  typeId: "",
  categoryId: "",
  price: "",
  priceNote: "",
  isActive: true,
  remarks: "",
  includes: "",
};

/** The editable fields of an existing procedure. */
function fieldsOfProcedure(initial: Procedure): ProcedureFormFields {
  return {
    name: initial.name,
    typeId: initial.typeId ?? "",
    typeName: initial.type?.name,
    categoryId: initial.categoryId ?? "",
    categoryName: initial.category?.name,
    price: initial.price?.toString() ?? "",
    priceNote: initial.priceNote ?? "",
    isActive: initial.isActive,
    remarks: initial.remarks ?? "",
    includes: initial.includes ?? "",
  };
}

type ProcedureFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Procedure | null;
};

export function ProcedureForm({ open, ...props }: ProcedureFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Procedure" : "New Procedure"}
    >
      <ProcedureFormBody {...props} />
    </Modal>
  );
}

function ProcedureFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<ProcedureFormProps, "open">) {
  const activeFieldId = useId();
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [form, setForm] = useState<ProcedureFormFields>(() =>
    initial ? fieldsOfProcedure(initial) : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof ProcedureFormFields, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      price: form.price ? round2(Number(form.price)) : 0,
    };
    if (isEdit) payload.isActive = form.isActive;
    if (isEdit || form.typeId) payload.typeId = form.typeId;
    if (isEdit || form.categoryId) payload.categoryId = form.categoryId;
    if (isEdit || form.priceNote) payload.priceNote = form.priceNote;
    if (isEdit || form.remarks) payload.remarks = form.remarks;
    if (isEdit || form.includes) payload.includes = form.includes;

    try {
      if (isEdit) {
        await api.put(`/procedures/${initial!.id}`, payload);
        addAlert("success", "Procedure updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>(
          "/procedures",
          payload,
        );
        addAlert("success", "Procedure created.");
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
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        )}
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Price">
          {({ id }) => (
            <MoneyInput
              id={id}
              min="0"
              value={form.price}
              onChange={(e) => update("price", clampNonNegative(e.target.value))}
            />
          )}
        </FormField>
        <FormField label="Price Note">
          {({ id }) => (
            <Input
              id={id}
              value={form.priceNote}
              onChange={(e) => update("priceNote", e.target.value)}
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Type">
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={form.typeId}
              onChange={(v) => update("typeId", v)}
              apiEndpoint="/procedure-types/dropdown"
              mapItem={(t) => ({ value: t.id, label: t.name })}
              placeholder="Select type…"
              defaultApiOption={
                form.typeName
                  ? { value: form.typeId, label: form.typeName }
                  : undefined
              }
              renderAddForm={
                can("procedure-types:write")
                  ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                      <ProcedureTypeForm
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
        <FormField label="Category">
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={form.categoryId}
              onChange={(v) => update("categoryId", v)}
              apiEndpoint="/procedure-categories/dropdown"
              mapItem={(c) => ({
                value: c.id,
                label: c.name,
              })}
              placeholder="Select category…"
              defaultApiOption={
                form.categoryName
                  ? { value: form.categoryId, label: form.categoryName }
                  : undefined
              }
              renderAddForm={
                can("procedure-categories:write")
                  ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                      <ProcedureCategoryForm
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

      <FormField label="Includes">
        {({ id }) => (
          <Input
            id={id}
            value={form.includes}
            onChange={(e) => update("includes", e.target.value)}
          />
        )}
      </FormField>

      <FormField label="Remarks">
        {({ id }) => (
          <textarea
            id={id}
            className={textareaClass}
            rows={2}
            value={form.remarks}
            onChange={(e) => update("remarks", e.target.value)}
          />
        )}
      </FormField>

      {isEdit && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={activeFieldId}
            checked={form.isActive}
            onCheckedChange={(value) => update("isActive", value)}
          />
          <label htmlFor={activeFieldId} className="text-sm font-medium">
            Active
          </label>
        </div>
      )}

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
