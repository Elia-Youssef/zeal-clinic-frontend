import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
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

/** The editable fields of an existing discount. */
function fieldsOfDiscount(initial: Discount): Fields {
  return {
    name: initial.name,
    description: initial.description ?? "",
    valueType: initial.valueType,
    value: String(initial.value),
    startDate: initial.startDate?.slice(0, 10) ?? "",
    endDate: initial.endDate?.slice(0, 10) ?? "",
    isActive: String(initial.isActive),
  };
}

type DiscountFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Discount;
};

export function DiscountForm({ open, ...props }: DiscountFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Discount" : "New Discount"}
    >
      <DiscountFormBody {...props} />
    </Modal>
  );
}

function DiscountFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<DiscountFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<Fields>(() =>
    initial ? fieldsOfDiscount(initial) : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initial;
  const isGift = isEdit && initial.discountType === "gift";

  const update = (field: keyof Fields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canSubmit = isGift
    ? !!form.name
    : form.name && form.valueType && Number(form.value) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = isGift
        ? { name: form.name, description: form.description }
        : {
            name: form.name,
            valueType: form.valueType,
            value: round2(Number(form.value)),
            isActive: Number(form.isActive),
          };
      if (!isGift) {
        if (isEdit || form.description) payload.description = form.description;
        if (isEdit || form.startDate)
          payload.startDate = form.startDate ? toISODate(form.startDate) : null;
        if (isEdit || form.endDate)
          payload.endDate = form.endDate ? toISODate(form.endDate) : null;
      }

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

      <FormField label="Description">
        {({ id }) => (
          <textarea
            id={id}
            className={textareaClass}
            rows={2}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        )}
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Value Type" required>
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={form.valueType}
              onChange={(v) => update("valueType", v)}
              options={discountValueTypeOptions}
              placeholder="Select…"
              disabled={isGift}
            />
          )}
        </FormField>
        <FormField label="Value" required>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              step="0.01"
              min="0"
              value={form.value}
              onChange={(e) => update("value", clampNonNegative(e.target.value))}
              required
              disabled={isGift}
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Start Date">
          {({ id }) => (
            <DatePicker
              id={id}
              value={form.startDate}
              onChange={(v) => update("startDate", v)}
              max={form.endDate}
              disabled={isGift}
            />
          )}
        </FormField>
        <FormField label="End Date">
          {({ id }) => (
            <DatePicker
              id={id}
              value={form.endDate}
              onChange={(v) => update("endDate", v)}
              min={form.startDate}
              disabled={isGift}
            />
          )}
        </FormField>
      </div>

      <FormField label="Status">
        {({ id }) => (
          <SearchableDropdown
            id={id}
            value={form.isActive}
            onChange={(v) => update("isActive", v)}
            options={[
              { value: "1", label: "Active" },
              { value: "0", label: "Inactive" },
            ]}
            placeholder="Select…"
            disabled={isGift}
          />
        )}
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
