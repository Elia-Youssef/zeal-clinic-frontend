import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Medicine } from "@/lib/types";

type MedicineFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Medicine;
};

export function MedicineForm({ open, ...props }: MedicineFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Medicine" : "New Medicine"}
    >
      <MedicineFormBody {...props} />
    </Modal>
  );
}

function MedicineFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<MedicineFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = { name, description: isEdit ? desc : desc || undefined };
    try {
      if (isEdit) {
        await api.put(`/medicines/${initial.id}`, payload);
        addAlert("success", "Medicine updated.");
      } else {
        const created = await api.post<Record<string, unknown>>("/medicines", payload);
        addAlert("success", "Medicine created.");
        onSaved(created);
        onClose();
        return;
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
