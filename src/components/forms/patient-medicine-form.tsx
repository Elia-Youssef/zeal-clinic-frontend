import { useState, useId } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { MedicineForm } from "@/components/forms/medicine-form";
import type { PatientMedicine } from "@/lib/types";

export function PatientMedicineForm({
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
  initial?: PatientMedicine | null;
}) {
  const fieldId = useId();
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [medicineId, setMedicineId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useAdjustOnChange([open, initial], () => {
    if (!open) return;
    setMedicineId(initial?.medicineId ?? "");
    setNotes(initial?.notes ?? "");
  });

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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Medicine" : "Add Medicine"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-medicine`} className="text-sm font-medium">Medicine *</label>
          {isEdit ? (
            <Input id={`${fieldId}-medicine`} value={initial?.medicineName ?? "---"} disabled />
          ) : (
            <SearchableDropdown
              id={`${fieldId}-medicine`}
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
    </Modal>
  );
}
