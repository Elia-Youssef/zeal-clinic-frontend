import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api, toISODateTime } from "@/lib/api";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import {
  getBeirutWallClockIssue,
  type BeirutWallClockIssue,
} from "@/lib/tz";
import { getErrorMessage } from "@/lib/utils";
import { useConfirm } from "@/hooks/use-confirm";
import { PatientForm } from "../patient-form";
import { RoomForm } from "../room-form";
import { ProcedureForm } from "../procedure-form";
import {
  type AppointmentFormData,
  type AppointmentProcedureSelection,
} from "./types";
import {
  addCalendarDays,
  calendarDayDiff,
  mergeInitial,
  isPastStartTime,
  timeDiffMinutes,
} from "./utils";

const MIN_DURATION_MINUTES = 15;

function wallClockIssueMessage(
  endpoint: "start" | "end",
  issue: BeirutWallClockIssue,
): string {
  const transition =
    issue === "nonexistent" ? "does not exist" : "occurs twice";
  return `The selected ${endpoint} time ${transition} in Beirut because of a daylight-saving transition. Choose another time.`;
}

function validateTimeRange(
  durationMinutes: number,
  startIssue: BeirutWallClockIssue | null,
  endIssue: BeirutWallClockIssue | null,
  calendarDaySpan: number,
): string | null {
  if (calendarDaySpan > 1)
    return "Appointment end date cannot be later than the following day.";
  if (startIssue) return wallClockIssueMessage("start", startIssue);
  if (endIssue) return wallClockIssueMessage("end", endIssue);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0)
    return "Appointment end must be after its start.";
  if (durationMinutes < MIN_DURATION_MINUTES)
    return `Appointment duration must be at least ${MIN_DURATION_MINUTES} minutes.`;
  return null;
}

function validateForm(
  form: AppointmentFormData,
  durationMinutes: number,
  startIssue: BeirutWallClockIssue | null,
  endIssue: BeirutWallClockIssue | null,
  calendarDaySpan: number,
): string | null {
  if (form.procedures.length === 0)
    return "At least one procedure is required.";
  if (!form.date || !form.endDate || !form.startTime || !form.endTime)
    return "Appointment date and time are required.";
  return validateTimeRange(
    durationMinutes,
    startIssue,
    endIssue,
    calendarDaySpan,
  );
}

const OFFSET_DATE_TIME = /(?:Z|[+-]\d{2}:\d{2})$/i;

function unchangedUtcInstant(
  raw: string | undefined,
  unchanged: boolean,
): string | undefined {
  if (!raw || !unchanged || !OFFSET_DATE_TIME.test(raw)) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function buildPayload(
  form: AppointmentFormData,
  initialData?: Partial<AppointmentFormData>,
  original?: AppointmentFormData,
) {
  const originalStart = unchangedUtcInstant(
    initialData?.startTime,
    !!original &&
      form.date === original.date &&
      form.startTime === original.startTime,
  );
  const originalEnd = unchangedUtcInstant(
    initialData?.endTime,
    !!original &&
      form.endDate === original.endDate &&
      form.endTime === original.endTime,
  );

  return {
    patientId: form.patientId,
    roomId: form.roomId,
    appointmentProcedures: form.procedures.map((p) => ({
      procedureId: p.id,
      assignedToId: p.assignedToId ?? "",
    })),
    startTime:
      originalStart ?? toISODateTime(`${form.date}T${form.startTime}`),
    endTime:
      originalEnd ?? toISODateTime(`${form.endDate}T${form.endTime}`),
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

  const startUnchanged =
    isEdit &&
    form.date === originalSnapshot.date &&
    form.startTime === originalSnapshot.startTime;
  const endUnchanged =
    isEdit &&
    form.endDate === originalSnapshot.endDate &&
    form.endTime === originalSnapshot.endTime;
  // Keep the exact API instant for an untouched endpoint. This is especially
  // important during the repeated DST hour, where one wall-clock value maps
  // to two different UTC instants.
  const originalStartUtc = unchangedUtcInstant(
    initialData?.startTime,
    startUnchanged,
  );
  const originalEndUtc = unchangedUtcInstant(initialData?.endTime, endUnchanged);
  const completeTimeRange =
    !!form.date && !!form.startTime && !!form.endDate && !!form.endTime;
  const startWallClockIssue =
    completeTimeRange && !originalStartUtc
      ? getBeirutWallClockIssue(`${form.date}T${form.startTime}`)
      : null;
  const endWallClockIssue =
    completeTimeRange && !originalEndUtc
      ? getBeirutWallClockIssue(`${form.endDate}T${form.endTime}`)
      : null;
  const durationMinutes = timeDiffMinutes(
    form.date,
    form.startTime,
    form.endDate,
    form.endTime,
    originalStartUtc,
    originalEndUtc,
  );
  const calendarDaySpan = calendarDayDiff(form.date, form.endDate);
  const timeValidationError = completeTimeRange
    ? validateTimeRange(
        durationMinutes,
        startWallClockIssue,
        endWallClockIssue,
        calendarDaySpan,
      )
    : null;
  const hasValidTimeRange =
    completeTimeRange && timeValidationError === null;
  const showPastStartWarning = isPastStartTime(
    form.date,
    form.startTime,
    originalStartUtc,
  );
  const canSubmit =
    !!form.patientId &&
    !!form.roomId &&
    form.procedures.length > 0 &&
    !!form.date &&
    !!form.endDate &&
    hasValidTimeRange;
  const timeChanged =
    isEdit &&
    (form.date !== originalSnapshot.date ||
      form.endDate !== originalSnapshot.endDate ||
      form.startTime !== originalSnapshot.startTime ||
      form.endTime !== originalSnapshot.endTime);
  const spansMultipleDays =
    !!form.date && !!form.endDate && form.endDate !== form.date;

  const updateStartDate = (value: string) =>
    setForm((prev) => {
      const dayOffset = prev.endDate
        ? Math.max(0, calendarDayDiff(prev.date, prev.endDate))
        : 0;
      return {
        ...prev,
        date: value,
        endDate: value ? addCalendarDays(value, dayOffset) : "",
      };
    });

  const updateEndTime = (value: string) =>
    setForm((prev) => {
      let endDate = prev.endDate || prev.date;
      const followingDate = prev.date ? addCalendarDays(prev.date, 1) : "";

      if (
        prev.date &&
        prev.startTime &&
        value &&
        endDate === prev.date &&
        value < prev.startTime
      ) {
        endDate = followingDate;
      }

      return { ...prev, endTime: value, endDate };
    });

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

  const setProcedureEmployee = (
    procedureId: string,
    employeeId: string,
    employeeLabel?: string,
  ) =>
    setForm((prev) => ({
      ...prev,
      procedures: prev.procedures.map((p) =>
        p.id === procedureId
          ? {
              ...p,
              assignedToId: employeeId || undefined,
              assignedToLabel: employeeId ? employeeLabel : undefined,
            }
          : p,
      ),
    }));

  const submitSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm(
      form,
      durationMinutes,
      startWallClockIssue,
      endWallClockIssue,
      calendarDaySpan,
    );
    if (error) {
      addAlert("error", error);
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(form, initialData, originalSnapshot);
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
    const error = validateForm(
      form,
      durationMinutes,
      startWallClockIssue,
      endWallClockIssue,
      calendarDaySpan,
    );
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
        ...buildPayload(form, initialData, originalSnapshot),
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
          disabled={isEdit}
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
          apiOptionsLimit={100}
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
        onSetEmployee={setProcedureEmployee}
        canCreateProcedure={canCreateProcedure}
      />

      <div
        className={`grid grid-cols-1 gap-4 ${
          spansMultipleDays ? "sm:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date *</label>
          <DatePicker
            value={form.date}
            onChange={updateStartDate}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Start Time *</label>
          <Input
            type="time"
            value={form.startTime}
            step={300}
            onChange={(v) => update("startTime", v.target.value)}
            required
          />
        </div>
        {spansMultipleDays && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End Date *</label>
            <DatePicker
              value={form.endDate}
              onChange={(value) => update("endDate", value)}
              min={form.date || undefined}
              max={
                form.date ? addCalendarDays(form.date, 1) : undefined
              }
              required
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">End Time *</label>
          <Input
            type="time"
            value={form.endTime}
            step={300}
            onChange={(v) => updateEndTime(v.target.value)}
            required
          />
        </div>
      </div>
      {timeValidationError && (
        <p className="text-xs text-destructive">{timeValidationError}</p>
      )}
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
  onSetEmployee,
  canCreateProcedure,
}: {
  procedures: AppointmentProcedureSelection[];
  onAdd: (option: AppointmentProcedureSelection) => void;
  onRemove: (id: string) => void;
  onSetEmployee: (
    procedureId: string,
    employeeId: string,
    employeeLabel?: string,
  ) => void;
  canCreateProcedure: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Procedures *</label>
      {procedures.length > 0 && (
        <div className="space-y-1.5">
          {procedures.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-2.5 py-1.5"
            >
              <span className="flex-1 min-w-0 text-sm font-medium wrap-break-word">
                {p.label}
              </span>
              <div className="w-40 shrink-0">
                <SearchableDropdown
                  value={p.assignedToId ?? ""}
                  onChange={(v) => {
                    if (!v) onSetEmployee(p.id, "", undefined);
                  }}
                  onSelectItem={(opt) =>
                    onSetEmployee(p.id, opt.value, opt.label)
                  }
                  defaultApiOption={
                    p.assignedToId && p.assignedToLabel
                      ? { value: p.assignedToId, label: p.assignedToLabel }
                      : undefined
                  }
                  apiEndpoint="/employees/dropdown"
                  mapItem={(item: { id: string; name: string }) => ({
                    value: item.id,
                    label: item.name,
                  })}
                  placeholder="Assign employee…"
                  clearable
                />
              </div>
              <button
                type="button"
                aria-label={`Remove ${p.label}`}
                onClick={() => onRemove(p.id)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
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
