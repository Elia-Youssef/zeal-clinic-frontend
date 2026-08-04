import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { AppointmentProcedureSelection } from "./types";

export function CancelPage({
  appointmentId,
  onBack,
  onSaved,
}: {
  appointmentId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      await api.put(`/appointments/${appointmentId}`, {
        status: "Cancelled",
        cancelNotes: reason || undefined,
      });
      addAlert("success", "Appointment cancelled.");
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Are you sure you want to cancel this appointment?
      </p>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Cancellation Reason</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for cancellation…"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="destructive"
          disabled={submitting}
          onClick={handleCancel}
        >
          {submitting ? "Cancelling…" : "Confirm Cancellation"}
        </Button>
      </div>
    </div>
  );
}

/** Warning shown alongside the confirm, keyed by the status being left. */
const REINSTATE_CAVEAT: Record<string, string> = {
  Cancelled:
    "Cancelled appointments don't hold their slot on the calendar, so this one may have been booked over since. Check the room before confirming.",
  Completed:
    "Any invoice or payment already recorded for this appointment stays as it is.",
};

export function ReinstatePage({
  appointmentId,
  status,
  onBack,
  onSaved,
}: {
  appointmentId: string;
  status: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [submitting, setSubmitting] = useState(false);
  const caveat = REINSTATE_CAVEAT[status];

  const handleReinstate = async () => {
    setSubmitting(true);
    try {
      // Only the status moves. The cancellation and completion notes are left
      // on the record as history; both are hidden while an appointment reads
      // Scheduled.
      await api.put(`/appointments/${appointmentId}`, {
        status: "Scheduled",
      });
      addAlert("success", "Appointment returned to scheduled.");
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Move this appointment back to <span className="font-medium">Scheduled</span>?
      </p>
      {caveat && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {caveat}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={submitting} onClick={handleReinstate}>
          {submitting ? "Saving…" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}

export function CompletePage({
  appointmentId,
  patientId,
  onBack,
  onCompleted,
  canContinue,
}: {
  appointmentId: string;
  patientId: string;
  onBack: () => void;
  onCompleted: (notes: string, advance: boolean) => void;
  canContinue: boolean;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async (advance: boolean) => {
    setSubmitting(true);
    try {
      await api.put(`/appointments/${appointmentId}`, {
        status: "Completed",
        completionNotes: notes || undefined,
      });
      addAlert("success", "Appointment completed.");
      onCompleted(notes, advance);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Completion Notes</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes about the appointment…"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => handleComplete(false)}
        >
          {submitting ? "Completing…" : "Complete"}
        </Button>
        {canContinue && (
          <Button
            type="button"
            disabled={submitting || !patientId}
            onClick={() => handleComplete(true)}
          >
            Complete & Continue
          </Button>
        )}
      </div>
    </div>
  );
}

export function InProgressPage({
  appointmentId,
  procedures,
  onBack,
  onSaved,
}: {
  appointmentId: string;
  procedures: AppointmentProcedureSelection[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<AppointmentProcedureSelection[]>(procedures);

  const allAssigned = useMemo(
    () => rows.length > 0 && rows.every((r) => !!r.assignedToId),
    [rows],
  );

  const setEmployee = (
    procedureId: string,
    employeeId: string,
    employeeLabel?: string,
  ) =>
    setRows((prev) =>
      prev.map((p) =>
        p.id === procedureId
          ? {
              ...p,
              assignedToId: employeeId || undefined,
              assignedToLabel: employeeId ? employeeLabel : undefined,
            }
          : p,
      ),
    );

  const handleStart = async () => {
    if (!allAssigned) {
      addAlert("error", "Assign an employee to every procedure first.");
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/appointments/${appointmentId}`, {
        status: "In-Progress",
        appointmentProcedures: rows.map((r) => ({
          procedureId: r.id,
          assignedToId: r.assignedToId ?? "",
        })),
      });
      addAlert("success", "Appointment marked in-progress.");
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assign an employee to each procedure before starting this appointment.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This appointment has no procedures.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-2 py-1.5"
            >
              <span className="flex-1 text-sm">{p.label}</span>
              <div className="w-56 shrink-0">
                <SearchableDropdown
                  value={p.assignedToId ?? ""}
                  onChange={(v) => {
                    if (!v) setEmployee(p.id, "", undefined);
                  }}
                  onSelectItem={(opt) =>
                    setEmployee(p.id, opt.value, opt.label)
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
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={submitting || !allAssigned}
          onClick={handleStart}
        >
          {submitting ? "Starting…" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
