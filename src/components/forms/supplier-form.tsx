"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Supplier } from "@/lib/types";

type SupplierFormFields = {
  name: string;
  contact: string;
  email: string;
  address: string;
  notes: string;
};

const emptyForm: SupplierFormFields = {
  name: "",
  contact: "",
  email: "",
  address: "",
  notes: "",
};

export function SupplierForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Supplier | null;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);

  const [form, setForm] = useState<SupplierFormFields>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        contact: initial.contact ?? "",
        email: initial.email ?? "",
        address: initial.address ?? "",
        notes: initial.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [initial]);

  const update = (field: keyof SupplierFormFields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name,
    };
    if (form.contact) payload.contact = form.contact;
    if (form.email) payload.email = form.email;
    if (form.address) payload.address = form.address;
    if (form.notes) payload.notes = form.notes;

    try {
      if (isEdit) {
        await api.put(`/suppliers/${initial!.id}`, payload);
        addAlert("success", "Supplier updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>("/suppliers", payload);
        addAlert("success", "Supplier created.");
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
      title={isEdit ? "Edit Supplier" : "New Supplier"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Supplier name"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact</label>
            <Input
              value={form.contact}
              onChange={(e) => update("contact", e.target.value)}
              placeholder="Phone number"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="email@example.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Address</label>
          <Input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Address"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Optional notes…"
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
