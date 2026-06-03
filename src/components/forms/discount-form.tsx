
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api, toISODate } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import { discountValueTypeOptions } from "@/lib/constants";
import type { Discount } from "@/lib/types";
import { DatePicker } from "../ui/date-picker";

type Fields = {
  name: string;
  description: string;
  valueType: string;
  value: string;
  startDate: string;
  endDate: string;
  isActive: string;
};

const emptyForm: Fields = {
  name: "",
  description: "",
  valueType: "percentage",
  value: "",
  startDate: "",
  endDate: "",
  isActive: "1",
};

export function DiscountForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Discount;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<Fields>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initial;

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name,
        description: initial.description ?? "",
        valueType: initial.valueType,
        value: String(initial.value),
        startDate: initial.startDate?.slice(0, 10) ?? "",
        endDate: initial.endDate?.slice(0, 10) ?? "",
        isActive: String(initial.isActive),
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, initial]);

  const update = (field: keyof Fields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canSubmit = form.name && form.valueType && Number(form.value) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        valueType: form.valueType,
        value: round2(Number(form.value)),
        isActive: Number(form.isActive),
      };
      if (isEdit || form.description) payload.description = form.description;
      if (isEdit || form.startDate)
        payload.startDate = form.startDate ? toISODate(form.startDate) : null;
      if (isEdit || form.endDate)
        payload.endDate = form.endDate ? toISODate(form.endDate) : null;

      if (isEdit) {
        await api.put(`/discounts/${initial.id}`, payload);
        addAlert("success", "Discount updated.");
        onSaved();
      } else {
        payload.discountType = "offer";
        const created = await api.post<Record<string, unknown>>(
          "/discounts",
          payload,
        );
        addAlert("success", "Discount created.");
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
      title={isEdit ? "Edit Discount" : "New Discount"}
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

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Value Type *</label>
            <SearchableDropdown
              value={form.valueType}
              onChange={(v) => update("valueType", v)}
              options={discountValueTypeOptions}
              placeholder="Select…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Value *</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.value}
              onChange={(e) => update("value", clampNonNegative(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start Date</label>
            <DatePicker
              value={form.startDate}
              onChange={(v) => update("startDate", v)}
              max={form.endDate}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End Date</label>
            <DatePicker
              value={form.endDate}
              onChange={(v) => update("endDate", v)}
              min={form.startDate}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Status</label>
          <SearchableDropdown
            value={form.isActive}
            onChange={(v) => update("isActive", v)}
            options={[
              { value: "1", label: "Active" },
              { value: "0", label: "Inactive" },
            ]}
            placeholder="Select…"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
