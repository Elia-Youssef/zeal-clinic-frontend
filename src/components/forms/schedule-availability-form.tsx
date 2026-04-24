"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ScheduleAvailability } from "@/lib/types";

const dayOptions = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

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
  defaultDayOfWeek?: number;
  defaultStartTime?: string;
  defaultEndTime?: string;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDayOfWeek(String(initial.dayOfWeek));
      setStartTime(initial.startTime.slice(0, 5));
      setEndTime(initial.endTime.slice(0, 5));
    } else {
      setDayOfWeek(defaultDayOfWeek ? String(defaultDayOfWeek) : "");
      setStartTime(defaultStartTime || "09:00");
      setEndTime(defaultEndTime || "17:00");
    }
  }, [open, initial, defaultDayOfWeek, defaultStartTime, defaultEndTime]);

  const canSubmit =
    !!dayOfWeek && !!startTime && !!endTime && startTime < endTime;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        employeeId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
      };
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
    if (!confirm("Delete this slot?")) return;
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
            options={dayOptions}
            placeholder="Select day…"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
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

        <div className="flex justify-end gap-2 pt-2">
          {isEdit && (
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
