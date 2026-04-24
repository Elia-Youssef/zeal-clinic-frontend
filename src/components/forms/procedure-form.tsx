"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Procedure } from "@/lib/types";

type ProcedureFormFields = {
  name: string;
  typeId: string;
  categoryId: string;
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

export function ProcedureForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Procedure | null;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<ProcedureFormFields>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        typeId: initial.typeId ?? "",
        categoryId: initial.categoryId ?? "",
        price: initial.price?.toString() ?? "",
        priceNote: initial.priceNote ?? "",
        isActive: initial.isActive,
        remarks: initial.remarks ?? "",
        includes: initial.includes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [initial]);

  const update = (field: keyof ProcedureFormFields, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      isActive: form.isActive,
      price: form.price ? Number(form.price) : 0,
    };
    if (form.typeId) payload.typeId = form.typeId;
    if (form.categoryId) payload.categoryId = form.categoryId;
    if (form.priceNote) payload.priceNote = form.priceNote;
    if (form.remarks) payload.remarks = form.remarks;
    if (form.includes) payload.includes = form.includes;

    try {
      if (isEdit) {
        await api.put(`/procedures/${initial!.id}`, payload);
        addAlert("success", "Procedure updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>("/procedures", payload);
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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Procedure" : "New Procedure"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <SearchableDropdown
              value={form.typeId}
              onChange={(v) => update("typeId", v)}
              apiEndpoint="/procedure-types/dropdown"
              mapItem={(t: any) => ({ value: t.id, label: t.name })}
              placeholder="Select type"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Price</label>
            <Input
              type="number"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Category</label>
          <SearchableDropdown
            value={form.categoryId}
            onChange={(v) => update("categoryId", v)}
            apiEndpoint="/procedure-categories/dropdown"
            mapItem={(c: any) => ({
              value: c.id,
              label: c.name,
            })}
            placeholder="Select category"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Price Note</label>
            <Input
              value={form.priceNote}
              onChange={(e) => update("priceNote", e.target.value)}
              placeholder="e.g. per session"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Includes</label>
            <Input
              value={form.includes}
              onChange={(e) => update("includes", e.target.value)}
              placeholder='e.g. ["Full Face","Underarms"]'
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="proc-isActive"
            checked={form.isActive}
            onChange={(e) => update("isActive", e.target.checked)}
            className="size-4 rounded border-input"
          />
          <label htmlFor="proc-isActive" className="text-sm font-medium">
            Active
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Remarks</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={form.remarks}
            onChange={(e) => update("remarks", e.target.value)}
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
