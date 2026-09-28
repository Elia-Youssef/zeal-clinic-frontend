import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { PatientForm } from "./patient-form";
import { usePermissions } from "@/hooks/use-permissions";

type GiftRedeemFormProps = {
  open: boolean;
  onClose: () => void;
  onRedeemed: () => void;
  prefilledCode?: string;
  codeLocked?: boolean;
};

export function GiftRedeemForm({ open, ...props }: GiftRedeemFormProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="Redeem Gift Card">
      <GiftRedeemFormBody {...props} />
    </Modal>
  );
}

function GiftRedeemFormBody({
  onClose,
  onRedeemed,
  prefilledCode,
  codeLocked,
}: Omit<GiftRedeemFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [code, setCode] = useState(prefilledCode ?? "");
  const [patientId, setPatientId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = code.trim() && patientId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/gift-cards/redeem", {
        code: code.trim(),
        patientId,
      });
      addAlert("success", "Gift card redeemed.");
      onRedeemed();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Code" required>
        {({ id }) => (
          <Input
            id={id}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GIFT-XXXX"
            className="font-mono"
            readOnly={codeLocked}
            required
          />
        )}
      </FormField>
      <FormField label="Patient" required>
        {({ id }) => (
          <SearchableDropdown
            id={id}
            value={patientId}
            onChange={setPatientId}
            apiEndpoint="/patients/dropdown"
            mapItem={(p: { id: string; name: string }) => ({
              value: p.id,
              label: p.name,
            })}
            placeholder="Select patient…"
            required
            renderAddForm={
              can("patients:write")
                ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                    <PatientForm
                      open={addOpen}
                      onClose={closeAdd}
                      onSaved={(created) => {
                        if (created) {
                          onCreated(
                            String(created.id),
                            `${created.firstName ?? ""} ${
                              created.lastName ?? ""
                            }`.trim(),
                          );
                        }
                      }}
                    />
                  )
                : undefined
            }
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? "Redeeming…" : "Redeem"}
        </Button>
      </div>
    </form>
  );
}
