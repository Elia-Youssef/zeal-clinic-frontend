
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { AllergyForm } from "@/components/forms/allergy-form";
import { usePermissions } from "@/hooks/use-permissions";
import type { ProductAllergyConflict } from "@/lib/types";

export function ProductAllergyConflictForm({
  open,
  onClose,
  onSaved,
  productId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  productId: string;
  initial?: ProductAllergyConflict | null;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [allergyId, setAllergyId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAllergyId(initial?.allergyId ?? "");
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (initial) {
        await api.put(`/product-allergy-conflicts/${initial.id}`, {
          notes: notes || undefined,
        });
        addAlert("success", "Conflict updated.");
      } else {
        if (!allergyId) return;
        await api.post(`/products/${productId}/allergy-conflicts`, {
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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Allergy Conflict" : "Add Allergy Conflict"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Allergy *</label>
          {isEdit ? (
            <Input value={initial?.allergyName ?? "---"} disabled />
          ) : (
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
          )}
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
          <Button type="submit" disabled={submitting || (!isEdit && !allergyId)}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
