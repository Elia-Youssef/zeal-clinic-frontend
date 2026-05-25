import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";

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
  onBack,
  onSaved,
}: {
  appointmentId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [submitting, setSubmitting] = useState(false);

  const handleStart = async () => {
    setSubmitting(true);
    try {
      await api.put(`/appointments/${appointmentId}`, {
        status: "In-Progress",
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
        Mark this appointment as in-progress?
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={submitting} onClick={handleStart}>
          {submitting ? "Starting…" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
