import { useState, useMemo, useId } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { DatePicker } from "@/components/ui/date-picker";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/shared/searchable-dropdown";
import { api, toISODate } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getErrorMessage } from "@/lib/utils";
import { MedicineForm } from "@/components/forms/medicine-form";
import { EmployeeForm } from "@/components/forms/employee-form";
import { usePermissions } from "@/hooks/use-permissions";
import type { Prescription } from "@/lib/types";

type MedicineDraft = {
  medicineId: string;
  instructions: string;
  medicineName?: string;
};

const blankMedicine = (): MedicineDraft => ({
  medicineId: "",
  instructions: "",
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
  const fieldId = useId();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const selfEmployeeId = useAuthStore((s) => s.employeeId);
  const selfName = useAuthStore((s) => s.user);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [medicines, setMedicines] = useState<MedicineDraft[]>([blankMedicine()]);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initial;

  // Without employees:read the /employees/dropdown endpoint 403s (which hard-
  // redirects). Fall back to a static list seeded with the current user's own
  // employee, plus the existing prescriber when editing.
  const canReadEmployees = can("employees:read");
  const selfOptions = useMemo<DropdownOption[]>(() => {
    const opts: DropdownOption[] = [];
    if (selfEmployeeId) opts.push({ value: selfEmployeeId, label: selfName });
    if (
      initial?.prescribedById &&
      initial.prescribedById !== selfEmployeeId &&
      initial.prescribedByName
    ) {
      opts.push({
        value: initial.prescribedById,
        label: initial.prescribedByName,
      });
    }
    return opts;
  }, [selfEmployeeId, selfName, initial]);

  useAdjustOnChange([open, initial], () => {
    if (!open) return;
    setForm(
      initial
        ? {
            prescribedById: initial.prescribedById ?? "",
            startDate: initial.startDate?.slice(0, 10) ?? "",
            endDate: initial.endDate?.slice(0, 10) ?? "",
          }
        : {
            ...emptyForm,
            // No employee picker available: default to the current user.
            prescribedById: canReadEmployees ? "" : selfEmployeeId,
          },
    );
    setMedicines(
      initial?.medicines?.length
        ? initial.medicines.map((m) => ({
            medicineId: m.medicineId,
            instructions: m.instructions ?? "",
            medicineName: m.medicineName,
          }))
        : [blankMedicine()],
    );
  });

  const update = (field: keyof FormFields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateMedicine = (idx: number, patch: Partial<MedicineDraft>) =>
    setMedicines((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );

  const removeMedicine = (idx: number) =>
    setMedicines((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit = !!form.startDate && !!form.prescribedById;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        patientId,
        prescribedById: form.prescribedById,
        startDate: toISODate(form.startDate),
        ...(form.endDate ? { endDate: toISODate(form.endDate) } : {}),
        // PUT replaces the medicine list wholesale, so always send the full set.
        medicines: medicines
          .filter((m) => m.medicineId)
          .map((m) => ({
            medicineId: m.medicineId,
            ...(m.instructions.trim()
              ? { instructions: m.instructions.trim() }
              : {}),
          })),
      };
      if (isEdit) {
        await api.put(`/prescriptions/${initial!.id}`, payload);
        addAlert("success", "Prescription updated.");
      } else {
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
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-prescribed-by`} className="text-sm font-medium">Prescribed By *</label>
          <SearchableDropdown
            id={`${fieldId}-prescribed-by`}
            value={form.prescribedById}
            onChange={(v) => update("prescribedById", v)}
            apiEndpoint={canReadEmployees ? "/employees/dropdown" : undefined}
            mapItem={
              canReadEmployees
                ? (item) => ({ value: item.id, label: item.name })
                : undefined
            }
            options={canReadEmployees ? undefined : selfOptions}
            placeholder="Select employee…"
            required
            defaultApiOption={
              canReadEmployees &&
              initial?.prescribedById &&
              initial?.prescribedByName
                ? {
                    value: initial.prescribedById,
                    label: initial.prescribedByName,
                  }
                : undefined
            }
            renderAddForm={
              canReadEmployees && can("employees:write")
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-start-date`} className="text-sm font-medium">Start Date *</label>
            <DatePicker
              id={`${fieldId}-start-date`}
              value={form.startDate}
              onChange={(v) => update("startDate", v)}
              required
              max={form.endDate}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-end-date`} className="text-sm font-medium">End Date</label>
            <DatePicker
              id={`${fieldId}-end-date`}
              value={form.endDate}
              onChange={(v) => update("endDate", v)}
              min={form.startDate}
            />
          </div>
        </div>

        <div className="space-y-2" role="group" aria-labelledby={`${fieldId}-medicines`}>
          <div className="flex items-center justify-between">
            <label id={`${fieldId}-medicines`} className="text-sm font-medium">Medicines</label>
            <Button
              type="button"
              size="sm"
              onClick={() => setMedicines((prev) => [...prev, blankMedicine()])}
            >
              <Plus className="size-3.5 mr-1" /> Add Medicine
            </Button>
          </div>

          {medicines.map((med, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Medicine #{idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeMedicine(idx)}
                  disabled={medicines.length === 1}
                  aria-label="Remove medicine"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <label htmlFor={`${fieldId}-medicine-${idx}-medicine`} className="text-sm font-medium">Medicine *</label>
                  <SearchableDropdown
                    id={`${fieldId}-medicine-${idx}-medicine`}
                    value={med.medicineId}
                    onChange={(v) => updateMedicine(idx, { medicineId: v })}
                    apiEndpoint="/medicines/dropdown"
                    mapItem={(m) => ({ value: m.id, label: m.name })}
                    placeholder="Select medicine…"
                    defaultApiOption={
                      med.medicineId && med.medicineName
                        ? { value: med.medicineId, label: med.medicineName }
                        : undefined
                    }
                    renderAddForm={
                      can("medicines:write")
                        ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                            <MedicineForm
                              open={addOpen}
                              onClose={closeAdd}
                              onSaved={(created) => {
                                if (created)
                                  onCreated(
                                    String(created.id),
                                    String(created.name),
                                  );
                              }}
                            />
                          )
                        : undefined
                    }
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <label htmlFor={`${fieldId}-medicine-${idx}-instructions`} className="text-sm font-medium">Instructions</label>
                  <Input
                    id={`${fieldId}-medicine-${idx}-instructions`}
                    placeholder="e.g. Twice daily after meals"
                    value={med.instructions}
                    onChange={(e) =>
                      updateMedicine(idx, { instructions: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
