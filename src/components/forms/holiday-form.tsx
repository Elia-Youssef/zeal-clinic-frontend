import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Holiday } from "@/lib/types";

type HolidayFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Holiday | null;
};

export function HolidayForm({ open, ...props }: HolidayFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Holiday" : "Add Holiday"}
    >
      <HolidayFormBody {...props} />
    </Modal>
  );
}

function HolidayFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<HolidayFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(
    initial?.startDate?.slice(0, 10) ?? "",
  );
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Name" required>
        {({ id }) => (
          <Input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Independence Day"
            required
          />
        )}
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Start Date" required>
          {({ id }) => (
            <DatePicker
              id={id}
              value={startDate}
              onChange={handleStartChange}
              required
              max={endDate}
            />
          )}
        </FormField>
        <FormField label="End Date" required>
          {({ id }) => (
            <DatePicker
              id={id}
              value={endDate}
              onChange={setEndDate}
              required
              min={startDate}
            />
          )}
        </FormField>
      </div>
      <FormField label="Notes">
        {({ id }) => (
          <Input
            id={id}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        )}
      </FormField>

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
  );
}
