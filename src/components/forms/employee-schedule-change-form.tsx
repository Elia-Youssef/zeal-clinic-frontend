import { useCallback, useState, useId } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { X } from "lucide-react";
import { format as fnsFormat } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { textareaClass } from "@/lib/form-styles";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { DetailField } from "@/components/shared/detail-field";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { formatTimeRange, getErrorMessage } from "@/lib/utils";
import type {
  EmployeeScheduleChange,
  EmployeeScheduleChangeStatus,
  EmployeeScheduleChangeType,
} from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

const statusBadgeVariant: Record<
  EmployeeScheduleChangeStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  accepted: "default",
  rejected: "destructive",
};

const typeOptions = [
  { value: "timeoff", label: "Time Off" },
  { value: "overtime", label: "Overtime" },
];

function formatDateRange(start: string, end: string) {
  if (!start) return "---";
  const s = new Date(`${start}T00:00:00`);
  if (!end || end === start) return fnsFormat(s, "EEE, MMM d, yyyy");
  const e = new Date(`${end}T00:00:00`);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${fnsFormat(s, sameYear ? "MMM d" : "MMM d, yyyy")} – ${fnsFormat(e, "MMM d, yyyy")}`;
}

function dayCount(start: string, end: string) {
  if (!start || !end || end === start) return 1;
  const ms =
    new Date(`${end}T00:00:00`).getTime() -
    new Date(`${start}T00:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export function EmployeeScheduleChangeForm({
  open,
  onClose,
  onSaved,
  employeeId,
  initial,
  defaultType,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  initial?: EmployeeScheduleChange | null;
  defaultType?: EmployeeScheduleChangeType;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}) {
  const fieldId = useId();
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const canManage = can("hr:write");
  const canDelete = can("hr:delete");

  const [type, setType] = useState<EmployeeScheduleChangeType>("timeoff");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<EmployeeScheduleChangeStatus>("pending");
  const [submitting, setSubmitting] = useState(false);
  // Existing changes open read-only; new requests open straight into the form.
  const [editing, setEditing] = useState(false);

  const seedFields = useCallback(() => {
    if (initial) {
      setType(initial.type ?? "timeoff");
      setStartDate(initial.startDate?.slice(0, 10) ?? "");
      setEndDate(initial.endDate?.slice(0, 10) ?? "");
      setStartTime(initial.startTime?.slice(0, 5) ?? "");
      setEndTime(initial.endTime?.slice(0, 5) ?? "");
      setNotes(initial.notes ?? "");
      setStatus(initial.status ?? "pending");
    } else {
      setType(defaultType ?? "timeoff");
      setStartDate(defaultDate ?? "");
      setEndDate(defaultDate ?? "");
      setStartTime(defaultStartTime ?? "");
      setEndTime(defaultEndTime ?? "");
      setNotes("");
      setStatus("pending");
    }
  }, [initial, defaultType, defaultDate, defaultStartTime, defaultEndTime]);

  useAdjustOnChange([open, initial, seedFields], () => {
    if (!open) return;
    seedFields();
    setEditing(!initial);
  });

  const isOvertime = type === "overtime";
  const bothTimesSet = !!startTime && !!endTime;
  const oneTimeSet = !!startTime !== !!endTime;
  const datesSet = !!startDate && !!endDate;
  const timesValid = !bothTimesSet || startTime < endTime;
  // Overtime always needs times; time-off may be full-day (no times).
  const timesOk = isOvertime ? bothTimesSet && timesValid : !oneTimeSet && timesValid;
  const canSubmit = datesSet && timesOk;

  const typeLabel = isOvertime ? "Overtime" : "Time Off";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      addAlert(
        "error",
        isOvertime && !bothTimesSet
          ? "Overtime requires a start and end time."
          : bothTimesSet && startTime >= endTime
            ? "End time must be after start time."
            : "Enter a valid range.",
      );
      return;
    }
    setSubmitting(true);
    try {
      // Server owns status on create/update.
      const payload: Record<string, unknown> = {
        employeeId,
        type,
        startDate,
        endDate,
      };
      if (bothTimesSet) {
        payload.startTime = startTime;
        payload.endTime = endTime;
      }
      if (notes) payload.notes = notes;

      if (isEdit) {
        await api.put(`/employee-schedule-changes/${initial!.id}`, payload);
        addAlert("success", `${typeLabel} updated.`);
      } else {
        await api.post("/employee-schedule-changes", payload);
        addAlert(
          "success",
          isOvertime
            ? "Overtime request submitted."
            : "Time off request submitted.",
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (next: EmployeeScheduleChangeStatus) => {
    if (!initial || !canManage) return;
    setSubmitting(true);
    try {
      await api.post(`/employee-schedule-changes/${initial.id}/status`, {
        status: next,
      });
      const verb =
        next === "accepted"
          ? "accepted"
          : next === "rejected"
            ? "rejected"
            : "marked pending";
      addAlert("success", `${typeLabel} ${verb}.`);
      setStatus(next);
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (
      !(await confirm({
        title: `Delete ${typeLabel.toLowerCase()}?`,
        description: isOvertime
          ? "Delete this overtime entry?"
          : "Delete this time off? The affected days will return to the regular schedule.",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await api.del(`/employee-schedule-changes/${initial.id}`);
      addAlert("success", `${typeLabel} removed.`);
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    seedFields();
    setEditing(false);
  };

  const showView = isEdit && !editing;

  const title = !isEdit
    ? isOvertime
      ? "Request Overtime"
      : "Request Time Off"
    : editing
      ? `Edit ${typeLabel}`
      : typeLabel;

  if (showView) {
    const hasTimes = !!startTime && !!endTime;
    const days = dayCount(startDate, endDate);
    return (
      <Modal open={open} onClose={onClose} title={title}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <DetailField label="Type">{typeLabel}</DetailField>
            <DetailField label="Status">
              <Badge
                variant={statusBadgeVariant[status]}
                className="capitalize"
              >
                {status}
              </Badge>
            </DetailField>
            <DetailField label={days > 1 ? "Dates" : "Date"}>
              {formatDateRange(startDate, endDate)}
              {days > 1 && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({days} days)
                </span>
              )}
            </DetailField>
            <DetailField label="Time">
              {hasTimes ? formatTimeRange(startTime, endTime) : "Full day"}
            </DetailField>
            {notes && (
              <DetailField className="sm:col-span-2" label="Notes">
                <p className="whitespace-pre-wrap">{notes}</p>
              </DetailField>
            )}
          </div>

          {canManage && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              {status !== "pending" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleStatusChange("pending")}
                >
                  Mark Pending
                </Button>
              )}
              {status !== "rejected" && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={submitting}
                  onClick={() => handleStatusChange("rejected")}
                >
                  Reject
                </Button>
              )}
              {status !== "accepted" && (
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleStatusChange("accepted")}
                >
                  Accept
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-type`} className="text-sm font-medium">Type *</label>
          <SearchableDropdown
            id={`${fieldId}-type`}
            value={type}
            onChange={(v) => setType(v as EmployeeScheduleChangeType)}
            options={typeOptions}
            placeholder="Select type…"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-start-date`} className="text-sm font-medium">Start Date *</label>
            <DatePicker
              id={`${fieldId}-start-date`}
              value={startDate}
              onChange={setStartDate}
              required
              max={endDate}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-end-date`} className="text-sm font-medium">End Date *</label>
            <DatePicker
              id={`${fieldId}-end-date`}
              value={endDate}
              onChange={setEndDate}
              required
              min={startDate}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-start-time`} className="text-sm font-medium">
              Start Time{isOvertime ? " *" : ""}
            </label>
            <div className="relative">
              <Input
                id={`${fieldId}-start-time`}
                type="time"
                value={startTime}
                max={endTime || undefined}
                onChange={(e) => setStartTime(e.target.value)}
                required={isOvertime}
                className={startTime ? "pr-8" : undefined}
              />
              {startTime && !isOvertime && (
                <button
                  type="button"
                  aria-label="Clear start time"
                  onClick={() => setStartTime("")}
                  className="absolute top-1/2 right-2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-end-time`} className="text-sm font-medium">
              End Time{isOvertime ? " *" : ""}
            </label>
            <div className="relative">
              <Input
                id={`${fieldId}-end-time`}
                type="time"
                value={endTime}
                min={startTime || undefined}
                onChange={(e) => setEndTime(e.target.value)}
                required={isOvertime}
                className={endTime ? "pr-8" : undefined}
              />
              {endTime && !isOvertime && (
                <button
                  type="button"
                  aria-label="Clear end time"
                  onClick={() => setEndTime("")}
                  className="absolute top-1/2 right-2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {isOvertime
            ? "Overtime requires start and end times. A multi-day range applies the window to every day."
            : "Leave both times blank for a full day(s) off. Set both for partial day(s) — the window applies to every day in the range."}
          {!isEdit && " Requests start as pending until approved."}
        </p>

        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-notes`} className="text-sm font-medium">Notes</label>
          <textarea
            id={`${fieldId}-notes`}
            className={textareaClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
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
          <Button
            type="button"
            variant="outline"
            onClick={isEdit ? cancelEdit : onClose}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Submit Request"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
