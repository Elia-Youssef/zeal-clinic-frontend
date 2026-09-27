import { useState, useId } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Expense } from "@/lib/types";

type Fields = {
  name: string;
  notes: string;
};

const emptyForm: Fields = {
  name: "",
  notes: "",
};

export function ExpenseForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
  initial?: Expense;
}) {
  const fieldId = useId();
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<Fields>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initial;

  useAdjustOnChange([open, initial], () => {
    if (!open) return;
    if (initial) {
      setForm({
        name: initial.name,
        notes: initial.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  });

  const update = (field: keyof Fields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canSubmit = !!form.name.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        notes: form.notes.trim(),
      };

      const saved = isEdit
        ? await api.put<Expense>(`/expenses/${initial.id}`, payload)
        : await api.post<Expense>("/expenses", payload);

      addAlert("success", isEdit ? "Expense updated." : "Expense created.");
      onSaved(saved);
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
      title={isEdit ? "Edit Expense" : "New Expense"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-name`} className="text-sm font-medium">Name *</label>
          <Input
            id={`${fieldId}-name`}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-notes`} className="text-sm font-medium">Notes</label>
          <textarea
            id={`${fieldId}-notes`}
            className={textareaClass}
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
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
