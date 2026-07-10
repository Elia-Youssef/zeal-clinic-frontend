import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, toISODateTime } from "@/lib/api";
import {
  appointmentStatusStyles,
  defaultAppointmentStatusStyle,
} from "@/lib/constants";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { Appointment } from "@/lib/types";
import { cn, getErrorMessage } from "@/lib/utils";
import {
  GRID_TOTAL_MINUTES,
  HOUR_HEIGHT,
  formatGridMinutes,
  gridMinutesToWallClock,
} from "./sched-utils";
import type { DragCandidate } from "./use-appointment-drag";

export function DragPreviewCard({
  appt,
  candidate,
  roomName,
}: {
  appt: Appointment;
  candidate: DragCandidate;
  roomName?: string;
}) {
  const statusStyle =
    appointmentStatusStyles[appt.status] ?? defaultAppointmentStatusStyle;
  const top = (candidate.startMin / 60) * HOUR_HEIGHT;
  const height = ((candidate.endMin - candidate.startMin) / 60) * HOUR_HEIGHT;

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 w-full overflow-hidden rounded-sm border border-l-5 bg-muted shadow-lg",
        statusStyle.rail,
        candidate.valid
          ? "ring-1 ring-primary/40"
          : "border-destructive/60 bg-destructive/10",
      )}
      style={{ top: `${top}rem`, height: `${height}rem` }}
    >
      <div className="flex h-full flex-col justify-center gap-0.5 px-1.5 py-0.5">
        <span className="truncate text-xs font-medium leading-tight tabular-nums">
          {formatGridMinutes(candidate.startMin)} -{" "}
          {formatGridMinutes(candidate.endMin)}
        </span>
        {roomName && (
          <span className="truncate text-[0.625rem] leading-tight text-muted-foreground">
            {roomName}
          </span>
        )}
        <span className="truncate text-[0.625rem] leading-tight text-muted-foreground">
          {appt.patientName || "---"}
        </span>
      </div>
    </div>
  );
}

export function DropActionMenu({
  appt,
  candidate,
  dateStr,
  timeChanged,
  alignRight,
  onClose,
  onSaved,
}: {
  appt: Appointment;
  candidate: DragCandidate;
  dateStr: string;
  timeChanged: boolean;
  alignRight: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [phase, setPhase] = useState<"actions" | "reason">("actions");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const buildPayload = () => ({
    patientId: appt.patientId,
    roomId: candidate.roomId,
    appointmentProcedures: (appt.appointmentProcedures ?? []).map((ap) => ({
      procedureId: ap.procedureId,
      assignedToId: ap.assignedToId ?? "",
    })),
    startTime: toISODateTime(
      `${dateStr}T${gridMinutesToWallClock(candidate.startMin)}`,
    ),
    endTime: toISODateTime(
      `${dateStr}T${gridMinutesToWallClock(candidate.endMin)}`,
    ),
    notes: appt.notes || undefined,
  });

  const submit = async (action: "save" | "reschedule") => {
    setSubmitting(true);
    try {
      if (action === "save") {
        await api.put(`/appointments/${appt.id}`, buildPayload());
        addAlert("success", "Appointment updated.");
      } else {
        await api.post(`/appointments/${appt.id}/reschedule`, {
          ...buildPayload(),
          cancelNotes: reason || undefined,
        });
        addAlert("success", "Appointment rescheduled.");
      }
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const placeAbove = candidate.endMin > GRID_TOTAL_MINUTES - 120;
  const anchorMin = placeAbove ? candidate.startMin : candidate.endMin;

  return (
    <>
      <div
        className="fixed inset-0 z-20"
        onClick={() => !submitting && onClose()}
      />
      <div
        className={cn(
          "absolute z-30 w-max rounded-md border bg-popover p-2 text-popover-foreground shadow-md",
          alignRight ? "right-0" : "left-0",
          placeAbove && "-translate-y-full",
        )}
        style={{
          top: `calc(${(anchorMin / 60) * HOUR_HEIGHT}rem ${placeAbove ? "-" : "+"} 0.25rem)`,
        }}
      >
        {phase === "actions" ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </Button>
            {timeChanged && (
              <Button
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() => setPhase("reason")}
              >
                Reschedule
              </Button>
            )}
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => submit("save")}
            >
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <div className="w-64 space-y-2">
            <textarea
              className={textareaClass}
              rows={2}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rescheduling…"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() => setPhase("actions")}
              >
                Back
              </Button>
              <Button
                size="sm"
                disabled={submitting}
                onClick={() => submit("reschedule")}
              >
                {submitting ? "Rescheduling…" : "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
