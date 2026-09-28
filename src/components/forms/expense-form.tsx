import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
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

type ExpenseFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
  initial?: Expense;
};

export function ExpenseForm({ open, ...props }: ExpenseFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Expense" : "New Expense"}
    >
      <ExpenseFormBody {...props} />
    </Modal>
  );
}

function ExpenseFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<ExpenseFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<Fields>(() =>
    initial ? { name: initial.name, notes: initial.notes ?? "" } : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initial;

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

      <FormField label="Notes">
        {({ id }) => (
          <textarea
            id={id}
            className={textareaClass}
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
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
