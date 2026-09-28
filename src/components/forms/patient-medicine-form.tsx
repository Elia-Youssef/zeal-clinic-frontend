import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { MedicineForm } from "@/components/forms/medicine-form";
import type { PatientMedicine } from "@/lib/types";

type PatientMedicineFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patientId: string;
  initial?: PatientMedicine | null;
};

export function PatientMedicineForm({
  open,
  ...props
}: PatientMedicineFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Medicine" : "Add Medicine"}
    >
      <PatientMedicineFormBody {...props} />
    </Modal>
  );
}

function PatientMedicineFormBody({
  onClose,
  onSaved,
  patientId,
  initial,
}: Omit<PatientMedicineFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [medicineId, setMedicineId] = useState(initial?.medicineId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (initial) {
        await api.put(`/patient-medicines/${initial.id}`, {
          notes: notes || undefined,
        });
        addAlert("success", "Medicine updated.");
      } else {
        if (!medicineId) return;
        await api.post(`/patients/${patientId}/medicines`, {
          medicineId,
          notes: notes || undefined,
        });
        addAlert("success", "Medicine added.");
      }
      setMedicineId("");
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
      <FormField label="Medicine" required>
        {({ id }) =>
          isEdit ? (
            <Input id={id} value={initial?.medicineName ?? "---"} disabled />
          ) : (
            <SearchableDropdown
              id={id}
              value={medicineId}
              onChange={setMedicineId}
              apiEndpoint="/medicines/dropdown"
              mapItem={(m) => ({ value: m.id, label: m.name })}
              placeholder="Select…"
              renderAddForm={({
                open: addOpen,
                onClose: closeAdd,
                onCreated,
              }) => (
                <MedicineForm
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
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || (!isEdit && !medicineId)}
        >
          {submitting ? "Saving…" : isEdit ? "Update" : "Add"}
        </Button>
      </div>
    </form>
  );
}
