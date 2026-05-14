
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { DateInput } from "@/components/shared/date-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api, toISODate } from "@/lib/api";
import { selectClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { MedicineForm } from "@/components/forms/medicine-form";
import { EmployeeForm } from "@/components/forms/employee-form";
import type { Prescription } from "@/lib/types";
import { DatePicker } from "../ui/date-picker";
import { usePermissions } from "@/hooks/use-permissions";

type MedicineDraft = {
  medicineId: string;
  instructions: string;
  status: string;
};

const blankMedicine = (): MedicineDraft => ({
  medicineId: "",
  instructions: "",
  status: "active",
});

type FormFields = {
  prescribedById: string;
  startDate: string;
  endDate: string;
};

const emptyForm: FormFields = {
  prescribedById: "",
  startDate: "",
  endDate: "",
};

export function PrescriptionForm({
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
  initial?: Prescription | null;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [medicines, setMedicines] = useState<MedicineDraft[]>([blankMedicine()]);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initial;

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              prescribedById: initial.prescribedById ?? "",
              startDate: initial.startDate?.slice(0, 10) ?? "",
              endDate: initial.endDate?.slice(0, 10) ?? "",
            }
          : emptyForm,
      );
      setMedicines(isEdit ? [] : [blankMedicine()]);
    }
  }, [open, initial]);

  const update = (field: keyof FormFields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate) return;
    setSubmitting(true);
    try {
      if (isEdit) {
        const payload: Record<string, string> = {
          startDate: toISODate(form.startDate),
        };
        if (form.prescribedById)
          payload.prescribedById = form.prescribedById;
        if (form.endDate) payload.endDate = toISODate(form.endDate);
        await api.put(`/prescriptions/${initial!.id}`, payload);
        addAlert("success", "Prescription updated.");
      } else {
        const validMeds = medicines.filter((m) => m.medicineId);
        const payload: Record<string, unknown> = {
          patientId,
          startDate: toISODate(form.startDate),
        };
        if (form.prescribedById)
          payload.prescribedById = form.prescribedById;
        if (form.endDate) payload.endDate = toISODate(form.endDate);
        if (validMeds.length > 0) payload.medicines = validMeds;
        await api.post("/prescriptions", payload);
        addAlert("success", "Prescription created.");
      }
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
      title={isEdit ? "Edit Prescription" : "New Prescription"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start Date *</label>
            <DatePicker
              value={form.startDate}
              onChange={(v) => update("startDate", v)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End Date</label>
            <DatePicker
              value={form.endDate}
              onChange={(v) => update("endDate", v)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Prescribed By</label>
          <SearchableDropdown
            value={form.prescribedById}
            onChange={(v) => update("prescribedById", v)}
            apiEndpoint="/employees/dropdown"
            mapItem={(item: any) => ({ value: item.id, label: item.name })}
            placeholder="Select employee…"
            renderAddForm={
              can("employees:write")
                ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                    <EmployeeForm
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

        {!isEdit && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Medicines</label>
            {medicines.map((med, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end"
              >
                <SearchableDropdown
                  value={med.medicineId}
                  onChange={(v) =>
                    setMedicines((prev) =>
                      prev.map((m, i) =>
                        i === idx ? { ...m, medicineId: v } : m,
                      ),
                    )
                  }
                  apiEndpoint="/medicines/dropdown"
                  mapItem={(m: any) => ({ value: m.id, label: m.name })}
                  placeholder="Medicine…"
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
                <Input
                  placeholder="Instructions"
                  value={med.instructions}
                  onChange={(e) =>
                    setMedicines((prev) =>
                      prev.map((m, i) =>
                        i === idx
                          ? { ...m, instructions: e.target.value }
                          : m,
                      ),
                    )
                  }
                />
                <select
                  className={selectClass}
                  value={med.status}
                  onChange={(e) =>
                    setMedicines((prev) =>
                      prev.map((m, i) =>
                        i === idx ? { ...m, status: e.target.value } : m,
                      ),
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    setMedicines((prev) => prev.filter((_, i) => i !== idx))
                  }
                  disabled={medicines.length === 1}
                >
                  <span className="text-destructive text-xs">✕</span>
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setMedicines((prev) => [...prev, blankMedicine()])
              }
            >
              <Plus className="size-3.5 mr-1" /> Add Medicine
            </Button>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !form.startDate}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
