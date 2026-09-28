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
import { usePermissions } from "@/hooks/use-permissions";
import type { ProcedureAllergyConflict } from "@/lib/types";

type ProcedureAllergyConflictFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  procedureId: string;
  initial?: ProcedureAllergyConflict | null;
};

export function ProcedureAllergyConflictForm({
  open,
  ...props
}: ProcedureAllergyConflictFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Allergy Conflict" : "Add Allergy Conflict"}
    >
      <ProcedureAllergyConflictFormBody {...props} />
    </Modal>
  );
}

function ProcedureAllergyConflictFormBody({
  onClose,
  onSaved,
  procedureId,
  initial,
}: Omit<ProcedureAllergyConflictFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [allergyId, setAllergyId] = useState(initial?.allergyId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (initial) {
        await api.put(`/procedure-allergy-conflicts/${initial.id}`, {
          notes: notes || undefined,
        });
        addAlert("success", "Conflict updated.");
      } else {
        if (!allergyId) return;
        await api.post(`/procedures/${procedureId}/allergy-conflicts`, {
          allergyId,
          notes: notes || undefined,
        });
        addAlert("success", "Conflict added.");
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
              renderAddForm={
                can("allergies:write")
                  ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                      <AllergyForm
                        open={addOpen}
                        onClose={closeAdd}
                        onSaved={(created) => {
                          if (created)
                            onCreated(String(created.id), String(created.name));
                        }}
                      />
                    )
                  : undefined
              }
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
