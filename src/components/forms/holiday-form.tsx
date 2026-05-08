
import { useEffect, useState } from "react";
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
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
  }, [open, initial]);

  // Auto-mirror endDate when the user picks a startDate first. This covers the
  // common single-day case without forcing them to fill both fields.
  const handleStartChange = (next: string) => {
    setStartDate(next);
    if (!endDate || endDate < next) setEndDate(next);
  };

  const canSubmit =
    !!name.trim() && !!startDate && !!endDate && startDate <= endDate;

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
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Independence Day"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start Date *</label>
            <DatePicker value={startDate} onChange={handleStartChange} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End Date *</label>
            <DatePicker value={endDate} onChange={setEndDate} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <Input
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
