import { useState, useId } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { AllergyForm } from "@/components/forms/allergy-form";
import type { PatientAllergy } from "@/lib/types";

export function PatientAllergyForm({
  open,
  onClose,
  onSaved,
  patientId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patientId: string;
  initial?: PatientAllergy | null;
}) {
  const fieldId = useId();
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [allergyId, setAllergyId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useAdjustOnChange([open, initial], () => {
    if (!open) return;
    setAllergyId(initial?.allergyId ?? "");
    setNotes(initial?.notes ?? "");
  });

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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Allergy" : "Add Allergy"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-allergy`} className="text-sm font-medium">Allergy *</label>
          {isEdit ? (
            <Input id={`${fieldId}-allergy`} value={initial?.allergyName ?? "---"} disabled />
          ) : (
            <SearchableDropdown
              id={`${fieldId}-allergy`}
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
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-notes`} className="text-sm font-medium">Notes</label>
          <Input
            id={`${fieldId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || (!isEdit && !allergyId)}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
