import { useMemo, useState } from "react";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
} from "lucide-react";
import { cn, formatTimeRange } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScheduleAvailabilityForm } from "@/components/forms/schedule-availability-form";
import { EmployeeVacationForm } from "@/components/forms/employee-vacation-form";
import type {
  EmployeeScheduleDay,
  EmployeeVacation,
  ScheduleAvailability,
} from "@/lib/types";
import { shift } from "node_modules/@base-ui/react/esm/floating-ui-react";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 60;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => i + DAY_START_HOUR,
);
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
const GRID_COLS = `50px 12px repeat(7, 1fr)`;

// Backend day-of-week convention: 0 = Sunday … 6 = Saturday.
const DAYS: { api: number; label: string }[] = [
  { api: 0, label: "Sun" },
  { api: 1, label: "Mon" },
  { api: 2, label: "Tue" },
  { api: 3, label: "Wed" },
  { api: 4, label: "Thu" },
  { api: 5, label: "Fri" },
  { api: 6, label: "Sat" },
];

const offReasonStyles: Record<string, string> = {
  holiday: "bg-status-cancelled/15 border-status-cancelled/40",
  vacation: "bg-status-progress/15 border-status-progress/40",
  "no-schedule": "bg-muted/30 border-border",
};

const offReasonLabels: Record<string, string> = {
  holiday: "Holiday",
  vacation: "Time Off",
  "no-schedule": "Off",
};

function formatHour(hour: number) {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

function timeToDecimal(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

function padHour(hour: number) {
  return String(hour).padStart(2, "0");
}

/** Get the Sunday-anchored start of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Format YYYY-MM-DD without timezone surprises. */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function EmployeeWeekSchedule({
  employeeId,
  slots,
  scheduleDays,
  vacations,
  weekStart,
  onWeekChange,
  onChange,
  canEditGeneral,
  canRequestVacation,
}: {
  employeeId: string;
  slots: ScheduleAvailability[];
  scheduleDays: EmployeeScheduleDay[];
  vacations: EmployeeVacation[];
  weekStart: Date;
  onWeekChange: (next: Date) => void;
  onChange: () => void;
  canEditGeneral: boolean;
  /** Whether to expose the "+ Vacation" affordance and clickable markers.
   *  Submitting a vacation request only needs schedule:read. */
  canRequestVacation: boolean;
}) {
  const [genFormOpen, setGenFormOpen] = useState(false);
  const [genFormDay, setGenFormDay] = useState<number | undefined>();
  const [genFormStart, setGenFormStart] = useState<string | undefined>();
  const [genFormEnd, setGenFormEnd] = useState<string | undefined>();
  const [editingSlot, setEditingSlot] = useState<ScheduleAvailability | null>(
    null,
  );

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [vacFormOpen, setVacFormOpen] = useState(false);
  const [vacFormDate, setVacFormDate] = useState<string | undefined>();
  const [vacFormStart, setVacFormStart] = useState<string | undefined>();
  const [vacFormEnd, setVacFormEnd] = useState<string | undefined>();
  const [editingVacation, setEditingVacation] =
    useState<EmployeeVacation | null>(null);

  /* -------- Derived: dates of the visible week -------- */
  const weekDates = useMemo(() => {
    const start = startOfWeek(weekStart);
    return DAYS.map((day, i) => {
      const d = addDays(start, i);
      return { ...day, date: d, iso: toISODate(d) };
    });
  }, [weekStart]);

  /* Index projected schedule days by ISO date. */
  const dayByDate = useMemo(() => {
    const map: Record<string, EmployeeScheduleDay> = {};
    for (const d of scheduleDays) {
      const iso = d.workDate?.slice(0, 10);
      if (iso) map[iso] = d;
    }
    return map;
  }, [scheduleDays]);

  /* Index vacations by ISO date: a multi-day vacation appears on every
   * day it covers, so users can click any of those days to edit it. */
  const vacationsByDate = useMemo(() => {
    const map: Record<string, EmployeeVacation[]> = {};
    for (const v of vacations) {
      const start = v.startDate?.slice(0, 10);
      const end = v.endDate?.slice(0, 10) || start;
      if (!start) continue;
      let cursor = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);
      while (cursor.getTime() <= endDate.getTime()) {
        const iso = toISODate(cursor);
        (map[iso] ??= []).push(v);
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [vacations]);

  const todayIso = toISODate(new Date());

  /* -------- Form openers -------- */
  const openAddGeneral = (dayApi: number, hour?: number) => {
    if (!canEditGeneral) return;
    setEditingSlot(null);
    setGenFormDay(dayApi);
    if (hour !== undefined) {
      setGenFormStart(`${padHour(hour)}:00`);
      setGenFormEnd(`${padHour(hour + 1)}:00`);
    } else {
      setGenFormStart(undefined);
      setGenFormEnd(undefined);
    }
    setGenFormOpen(true);
  };

  const openEditGeneral = (slot: ScheduleAvailability) => {
    if (!canEditGeneral) return;
    setEditingSlot(slot);
    setGenFormDay(undefined);
    setGenFormStart(undefined);
    setGenFormEnd(undefined);
    setGenFormOpen(true);
  };

  const openAddVacation = (iso?: string, hour?: number) => {
    if (!canRequestVacation) return;
    setEditingVacation(null);
    setVacFormDate(iso);
    if (hour !== undefined) {
      setVacFormStart(`${padHour(hour)}:00`);
      setVacFormEnd(`${padHour(hour + 1)}:00`);
    } else {
      setVacFormStart(undefined);
      setVacFormEnd(undefined);
    }
    setVacFormOpen(true);
  };

  const openEditVacation = (v: EmployeeVacation) => {
    if (!canRequestVacation) return;
    setEditingVacation(v);
    setVacFormDate(undefined);
    setVacFormStart(undefined);
    setVacFormEnd(undefined);
    setVacFormOpen(true);
  };

  const closeForms = () => {
    setGenFormOpen(false);
    setVacFormOpen(false);
    setEditingSlot(null);
    setEditingVacation(null);
  };

  /* -------- Week navigation -------- */
  const gotoPrev = () => onWeekChange(addDays(weekStart, -7));
  const gotoNext = () => onWeekChange(addDays(weekStart, 7));
  const gotoToday = () => onWeekChange(new Date());

  /* -------- Header label -------- */
  const headerLabel = useMemo(() => {
    const first = weekDates[0]?.date;
    const last = weekDates[6]?.date;
    if (!first || !last) return "";
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(first)} – ${fmt(last)}, ${last.getFullYear()}`;
  }, [weekDates]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Schedule</CardTitle>
        <div className="flex items-center gap-2">
          {canRequestVacation && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => openAddVacation()}
            >
              <Plus className="size-3.5" />
              Time Off
            </Button>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={gotoPrev}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs font-normal"
                  />
                }
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {headerLabel}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={weekStart}
                  onSelect={(date) => {
                    if (date) {
                      onWeekChange(date);
                      setDatePickerOpen(false);
                    }
                  }}
                  defaultMonth={weekStart}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={gotoNext}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={gotoToday}
              title="Go to this week"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <LegendChip
            className="bg-muted/40 border-dashed border"
            label="Template"
          />
          <LegendChip
            className="bg-primary/25 border-primary/50"
            label="Working"
          />
          <LegendChip className={offReasonStyles.holiday} label="Holiday" />
          <LegendChip
            className={offReasonStyles.vacation}
            label="Time off (accepted)"
          />
          <LegendChip
            className="bg-status-progress/10 border-dashed border-status-progress/60"
            label="Pending request"
          />
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-225">
            {/* Day headers */}
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <div />
              <div />
              {weekDates.map((day) => {
                const isToday = day.iso === todayIso;
                return (
                  <div
                    key={day.api}
                    className={cn(
                      "border-l border-border p-2 text-center",
                      isToday && "bg-primary/5",
                    )}
                  >
                    <div className="text-sm font-medium">{day.label}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {day.date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid body */}
            <div
              className="relative grid"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              {/* Time labels */}
              <div className="relative" style={{ height: GRID_HEIGHT }}>
                {HOURS.map((hour, i) => (
                  <div
                    key={hour}
                    className="absolute left-2 -translate-y-1/2 text-xs text-muted-foreground"
                    style={{ top: i * HOUR_HEIGHT }}
                  >
                    {i ? formatHour(hour) : ""}
                  </div>
                ))}
              </div>

              {/* Hour lines */}
              <div>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}
              </div>

              {/* Day columns */}
              {weekDates.map((day) => {
                const projected = dayByDate[day.iso];
                const dayVacations = vacationsByDate[day.iso] ?? [];
                const isToday = day.iso === todayIso;
                const offReason = projected?.isOff ? projected.offReason : "";
                return (
                  <div
                    key={day.api}
                    className={cn(
                      "relative border-l border-border",
                      isToday && "bg-primary/5",
                    )}
                  >
                    {/* Empty hour cells: clicking adds a template slot for
                     * this weekday at the picked hour. */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className={cn(
                          "border-b border-border",
                          canEditGeneral &&
                            "cursor-pointer transition-colors hover:bg-muted/30",
                        )}
                        style={{ height: HOUR_HEIGHT }}
                        onClick={() => openAddGeneral(day.api, hour)}
                      />
                    ))}

                    {/* Projected working shifts, only rendered when they
                     * carve up the template (partial-day time off). On a
                     * fully-working day the template block above already
                     * shows the working hours; on an off day there are no
                     * shifts. Shifts are display-only. */}
                    {projected &&
                      !offReason &&
                      projected.shifts.length > 0 &&
                      projected.shifts.map((shift, i) => {
                        const startDec = timeToDecimal(shift.startTime);
                        const endDec = timeToDecimal(shift.endTime);
                        const top = (startDec - DAY_START_HOUR) * HOUR_HEIGHT;
                        const height = (endDec - startDec) * HOUR_HEIGHT;
                        return (
                          <div
                            key={`shift-${day.iso}-${i}`}
                            className="pointer-events-none absolute inset-x-0.5 overflow-hidden rounded-md border border-primary/50 bg-primary/25 px-1 py-0.5 shadow-sm"
                            style={{ top, height: Math.max(height, 18) }}
                          >
                            <span className="truncate text-xs font-medium">
                              {formatTimeRange(shift.startTime, shift.endTime)}
                            </span>
                          </div>
                        );
                      })}

                    {/* Off-day banner. Skipped for "vacation" since the
                     * vacation marker below already conveys the same info. */}
                    {offReason && offReason !== "vacation" && (
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-x-0.5 top-0.5 flex items-center justify-center rounded-md border px-1 py-0.5",
                          offReasonStyles[offReason],
                        )}
                      >
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[10px] capitalize"
                        >
                          {offReasonLabels[offReason] ?? offReason}
                        </Badge>
                      </div>
                    )}

                    {/* Vacation markers, clickable so users can edit/delete.
                     * Pending = dashed border, rejected = greyed out, accepted
                     * uses the standard solid vacation style. The off-day
                     * banner above only renders for accepted vacations since
                     * the projection ignores non-accepted requests. */}
                    {dayVacations.map((v) => {
                      const hasTimes = !!v.startTime && !!v.endTime;
                      const startDec = hasTimes
                        ? timeToDecimal(v.startTime)
                        : DAY_START_HOUR;
                      const endDec = hasTimes
                        ? timeToDecimal(v.endTime)
                        : DAY_START_HOUR + 0.5;
                      const top = (startDec - DAY_START_HOUR) * HOUR_HEIGHT;
                      const height = (endDec - startDec) * HOUR_HEIGHT;
                      const statusClass =
                        v.status === "rejected"
                          ? "bg-muted/40 border-muted-foreground/30 opacity-60"
                          : v.status === "pending"
                            ? "bg-status-progress/10 border-dashed border-status-progress/60"
                            : offReasonStyles.vacation;
                      return (
                        <div
                          key={`vac-${v.id}-${day.iso}`}
                          className={cn(
                            "absolute inset-x-0.5 overflow-hidden rounded-md border px-1 py-0.5 shadow-sm",
                            statusClass,
                            canRequestVacation &&
                              "cursor-pointer hover:opacity-90",
                          )}
                          style={{
                            top: hasTimes ? top : 1,
                            height: hasTimes ? Math.max(height, 18) : 16,
                          }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEditVacation(v);
                          }}
                          title={`${v.status} time off${v.notes ? ` — ${v.notes}` : ""}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                "truncate text-xs font-medium",
                                v.status === "rejected" && "line-through",
                              )}
                            >
                              {hasTimes
                                ? formatTimeRange(v.startTime, v.endTime)
                                : "Time Off"}
                            </span>
                            {v.status !== "accepted" && (
                              <Badge
                                variant="outline"
                                className="h-4 px-1 text-[10px] capitalize"
                              >
                                {v.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>

      <ScheduleAvailabilityForm
        open={genFormOpen}
        onClose={closeForms}
        onSaved={onChange}
        employeeId={employeeId}
        initial={editingSlot}
        defaultDayOfWeek={genFormDay}
        defaultStartTime={genFormStart}
        defaultEndTime={genFormEnd}
      />
      <EmployeeVacationForm
        open={vacFormOpen}
        onClose={closeForms}
        onSaved={onChange}
        employeeId={employeeId}
        initial={editingVacation}
        defaultDate={vacFormDate}
        defaultStartTime={vacFormStart}
        defaultEndTime={vacFormEnd}
      />
    </Card>
  );
}

/* -------------------- internals -------------------- */

function LegendChip({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("inline-block size-3 rounded-sm border", className)}
      />
      {label}
    </span>
  );
}
