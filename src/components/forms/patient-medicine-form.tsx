"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { MedicineForm } from "@/components/forms/medicine-form";

export function PatientMedicineForm({
  open,
  onClose,
  onSaved,
  patientId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patientId: string;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [medicineId, setMedicineId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineId) return;
    setSubmitting(true);
    try {
      await api.post(`/patients/${patientId}/medicines`, {
        medicineId,
        notes: notes || undefined,
      });
      addAlert("success", "Medicine added.");
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
    <Modal open={open} onClose={onClose} title="Add Medicine">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Medicine *</label>
          <SearchableDropdown
            value={medicineId}
            onChange={setMedicineId}
            apiEndpoint="/medicines/dropdown"
            mapItem={(m: any) => ({ value: m.id, label: m.name })}
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
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !medicineId}>
            {submitting ? "Saving…" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
