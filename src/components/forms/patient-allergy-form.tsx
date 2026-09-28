import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { AllergyForm } from "@/components/forms/allergy-form";
import type { PatientAllergy } from "@/lib/types";

type PatientAllergyFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patientId: string;
  initial?: PatientAllergy | null;
};

export function PatientAllergyForm({
  open,
  ...props
}: PatientAllergyFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Allergy" : "Add Allergy"}
    >
      <PatientAllergyFormBody {...props} />
    </Modal>
  );
}

function PatientAllergyFormBody({
  onClose,
  onSaved,
  patientId,
  initial,
}: Omit<PatientAllergyFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [allergyId, setAllergyId] = useState(initial?.allergyId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (initial) {
        await api.put(`/patient-allergies/${initial.id}`, {
          notes: notes || undefined,
        });
        addAlert("success", "Allergy updated.");
      } else {
        if (!allergyId) return;
        await api.post(`/patients/${patientId}/allergies`, {
          allergyId,
          notes: notes || undefined,
        });
        addAlert("success", "Allergy added.");
      }
      setAllergyId("");
      setNotes("");
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
      <FormField label="Allergy" required>
        {({ id }) =>
          isEdit ? (
            <Input id={id} value={initial?.allergyName ?? "---"} disabled />
          ) : (
            <SearchableDropdown
              id={id}
              value={allergyId}
              onChange={setAllergyId}
              apiEndpoint="/allergies/dropdown"
              mapItem={(a) => ({ value: a.id, label: a.name })}
              placeholder="Select…"
              renderAddForm={({
                open: addOpen,
                onClose: closeAdd,
                onCreated,
              }) => (
                <AllergyForm
                  open={addOpen}
                  onClose={closeAdd}
                  onSaved={(created) => {
                    if (created)
                      onCreated(String(created.id), String(created.name));
                  }}
                />
              )}
            />
          )
        }
      </FormField>
      <FormField label="Notes">
        {({ id }) => (
          <Input
            id={id}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || (!isEdit && !allergyId)}>
          {submitting ? "Saving…" : isEdit ? "Update" : "Add"}
        </Button>
      </div>
    </form>
  );
}
