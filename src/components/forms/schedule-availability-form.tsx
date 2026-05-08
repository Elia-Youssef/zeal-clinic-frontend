
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { dayOfWeekOptions } from "@/lib/constants";
import type { ScheduleAvailability } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

export function ScheduleAvailabilityForm({
  open,
  onClose,
  onSaved,
  employeeId,
  initial,
  defaultDayOfWeek,
  defaultStartTime,
  defaultEndTime,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  initial?: ScheduleAvailability | null;
  /** 0 = Sunday … 6 = Saturday. */
  defaultDayOfWeek?: number;
  defaultStartTime?: string;
  defaultEndTime?: string;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [startDate, setStartDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDayOfWeek(String(initial.dayOfWeek));
      setStartTime(initial.startTime.slice(0, 5));
      setEndTime(initial.endTime.slice(0, 5));
      setStartDate(initial.startDate?.slice(0, 10) ?? "");
    } else {
      setDayOfWeek(
        defaultDayOfWeek !== undefined ? String(defaultDayOfWeek) : "",
      );
      setStartTime(defaultStartTime || "09:00");
      setEndTime(defaultEndTime || "17:00");
      setStartDate("");
    }
  }, [open, initial, defaultDayOfWeek, defaultStartTime, defaultEndTime]);

  const canSubmit =
    dayOfWeek !== "" && !!startTime && !!endTime && startTime < endTime;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        employeeId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
      };
      if (startDate) payload.startDate = startDate;
      if (isEdit) {
        await api.put(`/schedule-availability/${initial!.id}`, payload);
        addAlert("success", "Availability slot updated.");
      } else {
        await api.post("/schedule-availability", payload);
        addAlert("success", "Availability slot added.");
      }
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
        title: "Delete slot?",
        description: "Delete this slot?",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await api.del(`/schedule-availability/${initial.id}`);
      addAlert("success", "Slot removed.");
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
      title={isEdit ? "Edit Availability Slot" : "Add Availability Slot"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Day *</label>
          <SearchableDropdown
            value={dayOfWeek}
            onChange={setDayOfWeek}
            options={dayOfWeekOptions}
            placeholder="Select day…"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start Time *</label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End Time *</label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Effective From</label>
          <DatePicker value={startDate} onChange={setStartDate} />
          <p className="text-xs text-muted-foreground">
            Leave blank to start today. Editing time/day on an active slot
            archives the previous version.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {isEdit && can("schedule-availability:delete") && (
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
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Add Slot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
