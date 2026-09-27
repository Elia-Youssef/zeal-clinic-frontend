import { useState, useId } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Holiday } from "@/lib/types";

export function HolidayForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Holiday | null;
}) {
  const fieldId = useId();
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useAdjustOnChange([open, initial], () => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setStartDate(initial.startDate?.slice(0, 10) ?? "");
      setEndDate(initial.endDate?.slice(0, 10) ?? "");
      setNotes(initial.notes ?? "");
    } else {
      setName("");
      setStartDate("");
      setEndDate("");
      setNotes("");
    }
  });

  // Default to a single-day holiday.
  const handleStartChange = (next: string) => {
    setStartDate(next);
    if (!endDate) setEndDate(next);
  };

  const canSubmit = !!name.trim() && !!startDate && !!endDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        startDate,
        endDate,
        ...(notes ? { notes } : {}),
      };
      if (isEdit) {
        await api.put(`/holidays/${initial!.id}`, payload);
        addAlert("success", "Holiday updated.");
      } else {
        await api.post("/holidays", payload);
        addAlert("success", "Holiday added.");
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
      title={isEdit ? "Edit Holiday" : "Add Holiday"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-name`} className="text-sm font-medium">Name *</label>
          <Input
            id={`${fieldId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Independence Day"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-start-date`} className="text-sm font-medium">Start Date *</label>
            <DatePicker
              id={`${fieldId}-start-date`}
              value={startDate}
              onChange={handleStartChange}
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
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-notes`} className="text-sm font-medium">Notes</label>
          <Input
            id={`${fieldId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Holidays close the clinic — every employee's projected schedule
          across the date range will show as off. Use the same date in both
          fields for a single-day holiday.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Add Holiday"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
