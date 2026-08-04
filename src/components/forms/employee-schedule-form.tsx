import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { format as fnsFormat } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { cn, getErrorMessage } from "@/lib/utils";
import { beirutToday } from "@/lib/tz";
import { fmtDayOfWeek } from "@/lib/constants";
import {
  formatHours,
  timeToDecimal,
  validateShifts,
  type EmployeeScheduleVersion,
  type ShiftDraft,
} from "@/components/shared/employee-schedule-utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

/** What the editor was opened on: one weekday, seen from one date. */
export type ScheduleDayTarget = {
  /** 0 = Sunday, 6 = Saturday. */
  dayOfWeek: number;
  /** The date the editor was opened from; seeds the effective-from date. */
  date: string;
  /** The version covering `date`, when the weekday already has one. */
  version?: EmployeeScheduleVersion;
  /** An extra shift to append on open, seeded from a clicked calendar hour. */
  seed?: ShiftDraft;
};

const DEFAULT_SHIFT: ShiftDraft = { startTime: "09:00", endTime: "17:00" };

const displayDate = (iso: string) =>
  iso ? fnsFormat(new Date(`${iso}T00:00:00`), "d MMM yyyy") : "";

/** Gaps between consecutive shifts: the day's breaks. */
function breaksOf(shifts: ShiftDraft[]) {
  const sorted = [...shifts]
    .filter((s) => s.startTime && s.endTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const gaps: Array<{ from: string; to: string; hours: number }> = [];
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1].endTime;
    const to = sorted[i].startTime;
    const hours = timeToDecimal(to) - timeToDecimal(from);
    if (hours > 0) gaps.push({ from, to, hours });
  }
  return gaps;
}

/**
 * Edits one weekday's complete shift set. A weekday is a version (all of its
 * shifts share an effective date and are written together), so this form saves
 * the whole set, and saving an empty set turns the weekday into a day off.
 */
export function EmployeeScheduleForm({
  open,
  onClose,
  onSaved,
  employeeId,
  target,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  target: ScheduleDayTarget | null;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();
  const [shifts, setShifts] = useState<ShiftDraft[]>([]);
  // "update" replaces the existing version in place, retroactively; "new"
  // closes it and starts a fresh one. Keeping them apart stops a retroactive
  // rewrite from happening by accident.
  const [mode, setMode] = useState<"new" | "update">("new");
  const [startDate, setStartDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const version = target?.version;
  const dayLabel = target ? fmtDayOfWeek(target.dayOfWeek) : "";

  useEffect(() => {
    if (!open || !target) return;
    const existing =
      target.version?.shifts.map((s) => ({
        startTime: s.startTime.slice(0, 5),
        endTime: s.endTime.slice(0, 5),
      })) ?? [];
    const seeded = target.seed ? [...existing, target.seed] : existing;
    setShifts(seeded.length ? seeded : [DEFAULT_SHIFT]);
    setMode("new");
    // A future week defaults to the day being looked at; anything else to
    // today, so an edit doesn't silently reach back over dates already worked.
    const today = beirutToday();
    setStartDate(target.date > today ? target.date : today);
    setSubmitting(false);
  }, [open, target]);

  const breaks = useMemo(() => breaksOf(shifts), [shifts]);
  // The picked date is still allowed to land on the existing schedule's own
  // start, which the API treats as an in-place rewrite. Say so rather than
  // silently doing it.
  const rewritesInPlace =
    mode === "new" && !!version && startDate === version.startDate;

  const updateShift = (index: number, patch: Partial<ShiftDraft>) =>
    setShifts((prev) =>
      prev.map((shift, i) => (i === index ? { ...shift, ...patch } : shift)),
    );
  const removeShift = (index: number) =>
    setShifts((prev) => prev.filter((_, i) => i !== index));
  const addShift = () =>
    setShifts((prev) => [
      ...prev,
      prev.length
        ? { startTime: prev[prev.length - 1].endTime, endTime: "" }
        : DEFAULT_SHIFT,
    ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    const problem = validateShifts(shifts);
    if (problem) {
      addAlert("error", problem);
      return;
    }
    const effectiveFrom = mode === "update" ? version!.startDate : startDate;
    if (!effectiveFrom) {
      addAlert("error", "Pick the date this schedule starts on.");
      return;
    }
    // Updating a schedule that already covers worked days changes history.
    if (
      (mode === "update" || rewritesInPlace) &&
      version!.startDate < beirutToday() &&
      !(await confirm({
        title: "Update the existing schedule?",
        description: `These hours will replace ${dayLabel}'s schedule from ${displayDate(
          version!.startDate,
        )} onwards, including days already worked.`,
        confirmText: "Update",
      }))
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await api.put("/employee-schedules/day", {
        employeeId,
        dayOfWeek: target.dayOfWeek,
        startDate: effectiveFrom,
        shifts: shifts.map(({ startTime, endTime }) => ({
          startTime,
          endTime,
        })),
      });
      addAlert(
        "success",
        shifts.length
          ? "Schedule saved."
          : `${dayLabel} is now a day off from ${displayDate(effectiveFrom)}.`,
      );
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const rowId = version?.shifts[0]?.id;
    if (!rowId) return;
    if (
      !(await confirm({
        title: "Delete schedule?",
        description:
          "All of this day's shifts are removed, and the dates they covered will show as no schedule. Earlier and later schedules keep their own dates and won't stretch to fill the gap.",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await api.del(`/employee-schedules/${rowId}`);
      addAlert("success", "Schedule removed.");
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
      title={dayLabel ? `${dayLabel} Schedule` : "Schedule"}
      description={
        version
          ? `These hours have been in place since ${displayDate(version.startDate)}.`
          : "This weekday has no schedule yet."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Shifts</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addShift}
            >
              <Plus className="size-3.5 mr-1" /> Add Shift
            </Button>
          </div>

          {shifts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
              No shifts — {dayLabel} becomes a day off.
            </p>
          ) : (
            <div className="space-y-2">
              {shifts.map((shift, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`Shift ${idx + 1} start time`}
                    value={shift.startTime}
                    max={shift.endTime || undefined}
                    onChange={(e) =>
                      updateShift(idx, { startTime: e.target.value })
                    }
                    required
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    aria-label={`Shift ${idx + 1} end time`}
                    value={shift.endTime}
                    min={shift.startTime || undefined}
                    onChange={(e) =>
                      updateShift(idx, { endTime: e.target.value })
                    }
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeShift(idx)}
                    aria-label={`Remove shift ${idx + 1}`}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {breaks.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Break
              {breaks.length > 1 ? "s" : ""}:{" "}
              {breaks
                .map((b) => `${b.from}–${b.to} (${formatHours(b.hours)}h)`)
                .join(", ")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Save as</label>

          {version ? (
            <>
              <ModeCard
                selected={mode === "new"}
                onSelect={() => setMode("new")}
                title="Apply starting on this date"
                hint="Use this when the hours are changing. Days before this date keep the current hours."
              >
                <div className="space-y-1.5">
                  <DatePicker value={startDate} onChange={setStartDate} />
                  {rewritesInPlace && (
                    <p className="text-xs text-warning">
                      The current schedule already starts on this date — saving
                      updates it instead of adding a new one.
                    </p>
                  )}
                </div>
              </ModeCard>

              <ModeCard
                selected={mode === "update"}
                onSelect={() => setMode("update")}
                title="Update the existing schedule"
                hint={`Use this when the hours were entered wrong. Changes ${displayDate(
                  version.startDate,
                )}${
                  version.endDate
                    ? ` to ${displayDate(version.endDate)}`
                    : " onwards"
                }, including days already worked.`}
              />
            </>
          ) : (
            <div className="space-y-1.5">
              <DatePicker value={startDate} onChange={setStartDate} />
              <p className="text-xs text-muted-foreground">
                The date these hours start on.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {version && can("employee-schedules:delete") && (
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** One choice in the save-mode pair; the whole card is the hit target. */
function ModeCard({
  selected,
  onSelect,
  title,
  hint,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg border p-3 transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/40",
      )}
      onClick={onSelect}
    >
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="radio"
          name="schedule-save-mode"
          className="accent-primary"
          checked={selected}
          onChange={onSelect}
        />
        <span className="text-sm font-medium">{title}</span>
      </label>
      <div className="mt-2 space-y-1.5 pl-6">
        {children}
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
