import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api, toISODateTime } from "@/lib/api";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { useConfirm } from "@/hooks/use-confirm";
import { PatientForm } from "../patient-form";
import { RoomForm } from "../room-form";
import { ProcedureForm } from "../procedure-form";
import {
  type AppointmentFormData,
  type AppointmentProcedureSelection,
} from "./types";
import { mergeInitial, isPastStartTime, timeDiffMinutes } from "./utils";

const MIN_DURATION_MINUTES = 15;

function validateForm(
  form: AppointmentFormData,
  durationMinutes: number,
): string | null {
  if (form.procedures.length === 0)
    return "At least one procedure is required.";
  if (!form.startTime || !form.endTime || durationMinutes <= 0)
    return "End time must be after start time.";
  if (durationMinutes < MIN_DURATION_MINUTES)
    return `Appointment duration must be at least ${MIN_DURATION_MINUTES} minutes.`;
  return null;
}

function buildPayload(form: AppointmentFormData) {
  return {
    patientId: form.patientId,
    roomId: form.roomId,
    procedureIds: form.procedures.map((p) => p.id),
    startTime: toISODateTime(`${form.date}T${form.startTime}`),
    endTime: toISODateTime(`${form.date}T${form.endTime}`),
    notes: form.notes || undefined,
  };
}

export function MainPage({
  isEdit,
  initialData,
  onCancelEdit,
  onSaved,
  canDelete,
  canCreatePatient,
  canCreateRoom,
  canCreateProcedure,
}: {
  isEdit: boolean;
  initialData?: Partial<AppointmentFormData>;
  onCancelEdit: () => void;
  onSaved: () => void;
  canDelete: boolean;
  canCreatePatient: boolean;
  canCreateRoom: boolean;
  canCreateProcedure: boolean;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const confirm = useConfirm();
  const [originalSnapshot] = useState(() => mergeInitial(initialData));
  const [form, setForm] = useState<AppointmentFormData>(originalSnapshot);
  const [submitting, setSubmitting] = useState(false);
  const [reschedulePhase, setReschedulePhase] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");

  const update = <K extends keyof AppointmentFormData>(
    field: K,
    value: AppointmentFormData[K],
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const durationMinutes = timeDiffMinutes(form.startTime, form.endTime);
  const hasValidTimeRange =
    !!form.startTime &&
    !!form.endTime &&
    durationMinutes >= MIN_DURATION_MINUTES;
  const showPastStartWarning = isPastStartTime(form.date, form.startTime);
  const canSubmit =
    !!form.patientId &&
    !!form.roomId &&
    form.procedures.length > 0 &&
    !!form.date &&
    hasValidTimeRange;
  const timeChanged =
    isEdit &&
    (form.date !== originalSnapshot.date ||
      form.startTime !== originalSnapshot.startTime ||
      form.endTime !== originalSnapshot.endTime);

  const addProcedure = (option: AppointmentProcedureSelection) =>
    setForm((prev) =>
      prev.procedures.some((p) => p.id === option.id)
        ? prev
        : { ...prev, procedures: [...prev.procedures, option] },
    );

  const removeProcedure = (id: string) =>
    setForm((prev) => ({
      ...prev,
      procedures: prev.procedures.filter((p) => p.id !== id),
    }));

  const submitSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm(form, durationMinutes);
    if (error) {
      addAlert("error", error);
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(form);
      if (isEdit) {
        await api.put(`/appointments/${initialData!.id}`, payload);
        addAlert("success", "Appointment updated.");
      } else {
        await api.post("/appointments", { ...payload, status: "Scheduled" });
        addAlert("success", "Appointment created.");
      }
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const startReschedule = () => {
    const error = validateForm(form, durationMinutes);
    if (error) {
      addAlert("error", error);
      return;
    }
    setReschedulePhase(true);
  };

  const confirmReschedule = async () => {
    setSubmitting(true);
    try {
      await api.post(`/appointments/${initialData!.id}/reschedule`, {
        ...buildPayload(form),
        cancelNotes: rescheduleReason || undefined,
      });
      addAlert("success", "Appointment rescheduled.");
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete appointment?",
      description: "Delete this appointment?",
      confirmText: "Delete",
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      await api.del(`/appointments/${initialData!.id}`);
      addAlert("success", "Appointment deleted.");
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (reschedulePhase) {
    return (
      <ReschedulePhase
        reason={rescheduleReason}
        onReasonChange={setRescheduleReason}
        submitting={submitting}
        onBack={() => setReschedulePhase(false)}
        onConfirm={confirmReschedule}
      />
    );
  }

  return (
    <form onSubmit={submitSave} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Patient</label>
        <SearchableDropdown
          value={form.patientId}
          onChange={(value) => update("patientId", value)}
          defaultApiOption={
            form.patientLabel
              ? { value: form.patientId, label: form.patientLabel }
              : undefined
          }
          apiEndpoint="/patients/dropdown"
          mapItem={(p: { id: string; name: string }) => ({
            value: p.id,
            label: p.name,
          })}
          placeholder="Select patient…"
          required
          renderAddForm={
            canCreatePatient
              ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                  <PatientForm
                    open={addOpen}
                    onClose={closeAdd}
                    onSaved={(created) => {
                      if (created) {
                        onCreated(
                          String(created.id),
                          `${created.firstName} ${created.lastName}`,
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
        <label className="text-sm font-medium">Room</label>
        <SearchableDropdown
          value={form.roomId}
          onChange={(value) => update("roomId", value)}
          apiEndpoint="/rooms/dropdown"
          mapItem={(r: { id: string; name: string }) => ({
            value: r.id,
            label: r.name,
          })}
          placeholder="Select room…"
          apiOptionsLimit={10}
          required
          renderAddForm={
            canCreateRoom
              ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                  <RoomForm
                    open={addOpen}
                    onClose={closeAdd}
                    onSaved={(created) => {
                      if (created) {
                        onCreated(String(created.id), String(created.name));
                      }
                    }}
                  />
                )
              : undefined
          }
        />
      </div>

      <ProceduresField
        procedures={form.procedures}
        onAdd={addProcedure}
        onRemove={removeProcedure}
        canCreateProcedure={canCreateProcedure}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date *</label>
          <DatePicker
            value={form.date}
            onChange={(value) => update("date", value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Start Time *</label>
          <Input
            type="time"
            value={form.startTime}
            step={900}
            max={form.endTime || undefined}
            onChange={(v) => update("startTime", v.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">End Time *</label>
          <Input
            type="time"
            value={form.endTime}
            step={900}
            min={form.startTime || undefined}
            onChange={(v) => update("endTime", v.target.value)}
            required
          />
        </div>
      </div>
      {showPastStartWarning && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="size-3.5" />
          Start time has already passed.
        </p>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Optional notes…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {isEdit && canDelete && (
          <Button
            type="button"
            variant="destructive"
            className="mr-auto"
            disabled={submitting}
            onClick={handleDelete}
          >
            Delete
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancelEdit}>
          Cancel
        </Button>
        {timeChanged && (
          <Button
            type="button"
            variant="outline"
            disabled={submitting || !canSubmit}
            onClick={startReschedule}
          >
            Reschedule
          </Button>
        )}
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}

function ProceduresField({
  procedures,
  onAdd,
  onRemove,
  canCreateProcedure,
}: {
  procedures: AppointmentProcedureSelection[];
  onAdd: (option: AppointmentProcedureSelection) => void;
  onRemove: (id: string) => void;
  canCreateProcedure: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Procedures *</label>
      {procedures.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {procedures.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-muted/50 px-2 py-0.5 text-xs"
            >
              {p.label}
              <button
                type="button"
                aria-label={`Remove ${p.label}`}
                onClick={() => onRemove(p.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <SearchableDropdown
        value=""
        onChange={() => {}}
        onSelectItem={(opt) => onAdd({ id: opt.value, label: opt.label })}
        apiEndpoint="/procedures/dropdown"
        mapItem={(p: { id: string; name: string }) => ({
          value: p.id,
          label: p.name,
        })}
        placeholder="Add a procedure…"
        renderAddForm={
          canCreateProcedure
            ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                <ProcedureForm
                  open={addOpen}
                  onClose={closeAdd}
                  onSaved={(created) => {
                    if (created) {
                      onCreated(String(created.id), String(created.name));
                    }
                  }}
                />
              )
            : undefined
        }
      />
    </div>
  );
}

function ReschedulePhase({
  reason,
  onReasonChange,
  submitting,
  onBack,
  onConfirm,
}: {
  reason: string;
  onReasonChange: (value: string) => void;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Provide a reason for rescheduling this appointment.
      </p>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Reschedule Reason</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Reason for rescheduling…"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={onBack}
        >
          Back
        </Button>
        <Button disabled={submitting} onClick={onConfirm}>
          {submitting ? "Rescheduling…" : "Confirm Reschedule"}
        </Button>
      </div>
    </div>
  );
}
