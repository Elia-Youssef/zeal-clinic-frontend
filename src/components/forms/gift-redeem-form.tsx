
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { PatientForm } from "./patient-form";
import { usePermissions } from "@/hooks/use-permissions";

export function GiftRedeemForm({
  open,
  onClose,
  onRedeemed,
  prefilledCode,
  codeLocked,
}: {
  open: boolean;
  onClose: () => void;
  onRedeemed: () => void;
  prefilledCode?: string;
  codeLocked?: boolean;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [code, setCode] = useState("");
  const [patientId, setPatientId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(prefilledCode ?? "");
    setPatientId("");
    setCurrencyId("");
  }, [open, prefilledCode]);

  const canSubmit = code.trim() && patientId && currencyId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/gift-cards/redeem", {
        code: code.trim(),
        patientId,
        currencyId,
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
    <Modal open={open} onClose={onClose} title="Redeem Gift Card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Code *</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GIFT-XXXX"
            className="font-mono"
            readOnly={codeLocked}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Patient *</label>
          <SearchableDropdown
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
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Currency *</label>
          <SearchableDropdown
            value={currencyId}
            onChange={setCurrencyId}
            apiEndpoint="/currencies/dropdown"
            mapItem={(c: { id: string; name: string }) => ({
              value: c.id,
              label: c.name,
            })}
            placeholder="Select currency…"
            required
            defaultFirst
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Redeeming…" : "Redeem"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
