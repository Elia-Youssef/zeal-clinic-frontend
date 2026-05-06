
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { EmployeeVacation, EmployeeVacationStatus } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

const statusBadgeVariant: Record<
  EmployeeVacationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  accepted: "default",
  rejected: "destructive",
};

/**
 * Create / edit / delete an employee vacation. Supports full-day,
 * multi-day, and partial-day off (both times set, single day).
 *
 * Permissions:
 *  - Submitting a request (POST): any authenticated user (schedule:read).
 *    Server forces status="pending".
 *  - Editing dates/times/notes (PUT): schedule:write (admin).
 *  - Accept/reject/revert (POST /:id/status): schedule:write (admin).
 *  - Delete: schedule:delete (admin).
 */
export function EmployeeVacationForm({
  open,
  onClose,
  onSaved,
  employeeId,
  initial,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  initial?: EmployeeVacation | null;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const canManage = can("schedule:write");
  const canDelete = can("schedule:delete");
  // In edit mode the fields are admin-only; in create mode anyone with
  // schedule:read can submit a request, so the inputs are always editable.
  const fieldsEditable = !isEdit || canManage;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<EmployeeVacationStatus>("pending");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setStartDate(initial.startDate?.slice(0, 10) ?? "");
      setEndDate(initial.endDate?.slice(0, 10) ?? "");
      setStartTime(initial.startTime?.slice(0, 5) ?? "");
      setEndTime(initial.endTime?.slice(0, 5) ?? "");
      setNotes(initial.notes ?? "");
      setStatus(initial.status ?? "pending");
    } else {
      setStartDate(defaultDate ?? "");
      setEndDate(defaultDate ?? "");
      setStartTime(defaultStartTime ?? "");
      setEndTime(defaultEndTime ?? "");
      setNotes("");
      setStatus("pending");
    }
  }, [open, initial, defaultDate, defaultStartTime, defaultEndTime]);

  // Times must be both set or both empty. If set, vacation must be a single day.
  const bothTimesSet = !!startTime && !!endTime;
  const oneTimeSet = (!!startTime) !== (!!endTime);
  const datesValid = !!startDate && !!endDate && startDate <= endDate;
  const partialDayOk = !bothTimesSet || (startDate === endDate && startTime < endTime);
  const canSubmit = datesValid && !oneTimeSet && partialDayOk && fieldsEditable;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // status is intentionally omitted: the server forces "pending" on
      // POST and strips it from PUT.
      const payload: Record<string, unknown> = {
        employeeId,
        startDate,
        endDate,
      };
      if (bothTimesSet) {
        payload.startTime = startTime;
        payload.endTime = endTime;
      }
      if (notes) payload.notes = notes;

      if (isEdit) {
        await api.put(`/employee-vacations/${initial!.id}`, payload);
        addAlert("success", "Time off updated.");
      } else {
        await api.post("/employee-vacations", payload);
        addAlert("success", "Time off request submitted.");
      }
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (next: EmployeeVacationStatus) => {
    if (!initial || !canManage) return;
    setSubmitting(true);
    try {
      await api.post(`/employee-vacations/${initial.id}/status`, {
        status: next,
      });
      const verb =
        next === "accepted"
          ? "accepted"
          : next === "rejected"
            ? "rejected"
            : "marked pending";
      addAlert("success", `Time off ${verb}.`);
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
        title: "Delete time off?",
        description:
          "Delete this time off? The affected days will return to the regular schedule.",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await api.del(`/employee-vacations/${initial.id}`);
      addAlert("success", "Time off removed.");
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
      title={isEdit ? "Edit Time Off" : "Request Time Off"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isEdit && (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge
              variant={statusBadgeVariant[status]}
              className="capitalize"
            >
              {status}
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start Date *</label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              required
              disabled={!fieldsEditable}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End Date *</label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              required
              disabled={!fieldsEditable}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start Time</label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={!fieldsEditable}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End Time</label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={!fieldsEditable}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave both times blank for a full day(s) off. Set both to mark a
          partial day off — only allowed when start and end date match.
          {!isEdit && " Requests start as pending until approved."}
        </p>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            disabled={!fieldsEditable}
          />
        </div>

        {/* Admin status actions: accept / reject / revert. */}
        {isEdit && canManage && (
          <div className="flex flex-wrap gap-2 rounded-md border border-border bg-muted/20 p-2">
            {status !== "accepted" && (
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={submitting}
                onClick={() => handleStatusChange("accepted")}
              >
                Accept
              </Button>
            )}
            {status !== "rejected" && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={submitting}
                onClick={() => handleStatusChange("rejected")}
              >
                Reject
              </Button>
            )}
            {status !== "pending" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() => handleStatusChange("pending")}
              >
                Mark Pending
              </Button>
            )}
          </div>
        )}

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
          <Button type="button" variant="outline" onClick={onClose}>
            {isEdit && !fieldsEditable ? "Close" : "Cancel"}
          </Button>
          {fieldsEditable && (
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting
                ? "Saving…"
                : isEdit
                  ? "Update"
                  : "Submit Request"}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
