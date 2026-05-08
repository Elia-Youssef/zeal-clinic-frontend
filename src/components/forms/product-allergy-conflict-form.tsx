
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { AllergyForm } from "@/components/forms/allergy-form";
import { usePermissions } from "@/hooks/use-permissions";

export function ProductAllergyConflictForm({
  open,
  onClose,
  onSaved,
  productId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  productId: string;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [allergyId, setAllergyId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allergyId) return;
    setSubmitting(true);
    try {
      await api.post(`/products/${productId}/allergy-conflicts`, {
        allergyId,
        notes: notes || undefined,
      });
      addAlert("success", "Conflict added.");
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
    <Modal open={open} onClose={onClose} title="Add Allergy Conflict">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Allergy *</label>
          <SearchableDropdown
            value={allergyId}
            onChange={setAllergyId}
            apiEndpoint="/allergies/dropdown"
            mapItem={(a: any) => ({ value: a.id, label: a.name })}
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
          <Button type="submit" disabled={submitting || !allergyId}>
            {submitting ? "Saving…" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
