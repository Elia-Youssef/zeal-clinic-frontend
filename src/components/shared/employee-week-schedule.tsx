import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
} from "lucide-react";
import { cn, formatTimeRange } from "@/lib/utils";
import { api } from "@/lib/api";
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

const DAY_START = 8;
const DAY_END = 20;
const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => i + DAY_START);
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
const GRID_COLS = `50px 12px repeat(7, 1fr)`;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const offReasonStyle: Record<string, string> = {
  holiday: "bg-status-cancelled/15 border-status-cancelled/40",
  vacation: "bg-status-progress/15 border-status-progress/40",
  "no-schedule": "bg-muted/30 border-border",
};

const offReasonLabel: Record<string, string> = {
  holiday: "Holiday",
  vacation: "Time Off",
  "no-schedule": "Off",
};

const pad = (n: number) => String(n).padStart(2, "0");
const hourToTime = (h: number) => `${pad(h)}:00`;
const formatHour = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const timeToDecimal = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
};

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type ScheduleResponse = {
  days: EmployeeScheduleDay[];
  templates: ScheduleAvailability[];
  vacations: EmployeeVacation[];
};

type GenForm =
  | { open: false }
  | { open: true; mode: "add"; day: number; start: string; end: string }
  | { open: true; mode: "edit"; slot: ScheduleAvailability };

type VacForm =
  | { open: false }
  | { open: true; mode: "add"; date?: string; start?: string; end?: string }
  | { open: true; mode: "edit"; vacation: EmployeeVacation };

const closedGen: GenForm = { open: false };
const closedVac: VacForm = { open: false };

export function EmployeeWeekSchedule({
  employeeId,
  canEditGeneral,
  canRequestVacation,
}: {
  employeeId: string;
  canEditGeneral: boolean;
  canRequestVacation: boolean;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [data, setData] = useState<ScheduleResponse>({
    days: [],
    templates: [],
    vacations: [],
  });
  const [genForm, setGenForm] = useState<GenForm>(closedGen);
  const [vacForm, setVacForm] = useState<VacForm>(closedVac);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await api.get<ScheduleResponse>(
        `/employees/${employeeId}/schedule?date=${toIsoDate(weekStart)}`,
      );
      setData({
        days: res.days ?? [],
        templates: res.templates ?? [],
        vacations: res.vacations ?? [],
      });
    } catch {
      setData({ days: [], templates: [], vacations: [] });
    }
  }, [employeeId, weekStart]);

  useEffect(() => {
    reload();
  }, [reload]);

  const weekDates = useMemo(() => {
    const start = startOfWeek(weekStart);
    return DAYS.map((label, i) => {
      const date = addDays(start, i);
      return { dayOfWeek: i, label, date, iso: toIsoDate(date) };
    });
  }, [weekStart]);

  const dayByDate = useMemo(() => {
    const map: Record<string, EmployeeScheduleDay> = {};
    for (const d of data.days) {
      const iso = d.workDate?.slice(0, 10);
      if (iso) map[iso] = d;
    }
    return map;
  }, [data.days]);

  // Multi-day vacations can be edited from any covered day.
  const vacationsByDate = useMemo(() => {
    const map: Record<string, EmployeeVacation[]> = {};
    for (const v of data.vacations) {
      const start = v.startDate?.slice(0, 10);
      const end = v.endDate?.slice(0, 10) || start;
      if (!start) continue;
      let cursor = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);
      while (cursor.getTime() <= endDate.getTime()) {
        (map[toIsoDate(cursor)] ??= []).push(v);
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [data.vacations]);

  const todayIso = toIsoDate(new Date());

  const headerLabel = useMemo(() => {
    const first = weekDates[0]?.date;
    const last = weekDates[6]?.date;
    if (!first || !last) return "";
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(first)} - ${fmt(last)} ${last.getFullYear()}`;
  }, [weekDates]);

  const openAddSlot = (dayOfWeek: number, hour: number) => {
    if (!canEditGeneral) return;
    setGenForm({
      open: true,
      mode: "add",
      day: dayOfWeek,
      start: hourToTime(hour),
      end: hourToTime(hour + 1),
    });
  };
  const openEditSlot = (slot: ScheduleAvailability) => {
    if (!canEditGeneral) return;
    setGenForm({ open: true, mode: "edit", slot });
  };
  const openAddVacation = (date?: string, hour?: number) => {
    if (!canRequestVacation) return;
    setVacForm({
      open: true,
      mode: "add",
      date,
      start: hour !== undefined ? hourToTime(hour) : undefined,
      end: hour !== undefined ? hourToTime(hour + 1) : undefined,
    });
  };
  const openEditVacation = (vacation: EmployeeVacation) => {
    if (!canRequestVacation) return;
    setVacForm({ open: true, mode: "edit", vacation });
  };

  const genAdd = genForm.open && genForm.mode === "add" ? genForm : null;
  const genEdit = genForm.open && genForm.mode === "edit" ? genForm : null;
  const vacAdd = vacForm.open && vacForm.mode === "add" ? vacForm : null;
  const vacEdit = vacForm.open && vacForm.mode === "edit" ? vacForm : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <CardTitle className="min-w-0 flex-1 basis-32 text-base">
          Schedule
        </CardTitle>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
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
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
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
                      setWeekStart(startOfWeek(date));
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
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              title="Go to this week"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Legend />

        <div className="overflow-x-auto">
          <div className="min-w-225">
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <div />
              <div />
              {weekDates.map((day) => (
                <div
                  key={day.iso}
                  className={cn(
                    "border-l border-border p-2 text-center",
                    day.iso === todayIso && "bg-primary/5",
                  )}
                >
                  <div className="text-sm font-medium">{day.label}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {day.date.getDate()}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="relative grid"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <TimeColumn />
              <HourLines />
              {weekDates.map((day) => (
                <DayColumn
                  key={day.iso}
                  day={day}
                  isToday={day.iso === todayIso}
                  projected={dayByDate[day.iso]}
                  vacations={vacationsByDate[day.iso] ?? []}
                  templates={data.templates}
                  canEditGeneral={canEditGeneral}
                  canRequestVacation={canRequestVacation}
                  onAddSlot={openAddSlot}
                  onEditSlot={openEditSlot}
                  onEditVacation={openEditVacation}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>

      <ScheduleAvailabilityForm
        open={genForm.open}
        onClose={() => setGenForm(closedGen)}
        onSaved={reload}
        employeeId={employeeId}
        initial={genEdit?.slot ?? null}
        defaultDayOfWeek={genAdd?.day}
        defaultStartTime={genAdd?.start}
        defaultEndTime={genAdd?.end}
      />
      <EmployeeVacationForm
        open={vacForm.open}
        onClose={() => setVacForm(closedVac)}
        onSaved={reload}
        employeeId={employeeId}
        initial={vacEdit?.vacation ?? null}
        defaultDate={vacAdd?.date}
        defaultStartTime={vacAdd?.start}
        defaultEndTime={vacAdd?.end}
      />
    </Card>
  );
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <Chip className="bg-muted/40 border-dashed border" label="Template" />
      <Chip className="bg-primary/25 border-primary/50" label="Working" />
      <Chip className={offReasonStyle.holiday} label="Holiday" />
      <Chip className={offReasonStyle.vacation} label="Time off (accepted)" />
      <Chip
        className="bg-status-progress/10 border-dashed border-status-progress/60"
        label="Pending request"
      />
    </div>
  );
}

function Chip({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-3 rounded-sm border", className)} />
      {label}
    </span>
  );
}

function TimeColumn() {
  return (
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
  );
}

function HourLines() {
  return (
    <div>
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-border"
          style={{ height: HOUR_HEIGHT }}
        />
      ))}
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  projected,
  vacations,
  templates,
  canEditGeneral,
  canRequestVacation,
  onAddSlot,
  onEditSlot,
  onEditVacation,
}: {
  day: { dayOfWeek: number; iso: string };
  isToday: boolean;
  projected?: EmployeeScheduleDay;
  vacations: EmployeeVacation[];
  templates: ScheduleAvailability[];
  canEditGeneral: boolean;
  canRequestVacation: boolean;
  onAddSlot: (dayOfWeek: number, hour: number) => void;
  onEditSlot: (slot: ScheduleAvailability) => void;
  onEditVacation: (vacation: EmployeeVacation) => void;
}) {
  const offReason = projected?.isOff ? projected.offReason : "";
  const showShifts = projected && !offReason && projected.shifts.length > 0;

  return (
    <div
      className={cn(
        "relative border-l border-border",
        isToday && "bg-primary/5",
      )}
    >
      {HOURS.map((hour) => (
        <div
          key={hour}
          className={cn(
            "border-b border-border",
            canEditGeneral &&
              "cursor-pointer transition-colors hover:bg-muted/30",
          )}
          style={{ height: HOUR_HEIGHT }}
          onClick={() => onAddSlot(day.dayOfWeek, hour)}
        />
      ))}

      {/* Clicking a projected shift edits its matching template slot. */}
      {showShifts &&
        projected!.shifts.map((shift, i) => {
          const startDec = timeToDecimal(shift.startTime);
          const endDec = timeToDecimal(shift.endTime);
          const top = (startDec - DAY_START) * HOUR_HEIGHT;
          const height = (endDec - startDec) * HOUR_HEIGHT;
          const slot = templates.find(
            (t) =>
              t.dayOfWeek === day.dayOfWeek &&
              timeToDecimal(t.startTime) <= startDec &&
              timeToDecimal(t.endTime) >= endDec,
          );
          const clickable = canEditGeneral && !!slot;
          return (
            <div
              key={`shift-${i}`}
              className={cn(
                "absolute inset-x-0.5 overflow-hidden rounded-md border border-primary/50 bg-primary/25 px-1 py-0.5 shadow-sm",
                clickable
                  ? "cursor-pointer hover:bg-primary/35"
                  : "pointer-events-none",
              )}
              style={{ top, height: Math.max(height, 18) }}
              onClick={
                clickable
                  ? (e) => {
                      e.stopPropagation();
                      onEditSlot(slot);
                    }
                  : undefined
              }
            >
              <span className="truncate text-xs font-medium">
                {formatTimeRange(shift.startTime, shift.endTime)}
              </span>
            </div>
          );
        })}

      {/* Vacation markers already show vacation off-days. */}
      {offReason && offReason !== "vacation" && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0.5 top-0.5 flex items-center justify-center rounded-md border px-1 py-0.5",
            offReasonStyle[offReason],
          )}
        >
          <Badge
            variant="outline"
            className="h-4 px-1 text-[10px] capitalize"
          >
            {offReasonLabel[offReason] ?? offReason}
          </Badge>
        </div>
      )}

      {/* Pending/rejected vacations get distinct styling. */}
      {vacations.map((v) => {
        const hasTimes = !!v.startTime && !!v.endTime;
        const startDec = hasTimes ? timeToDecimal(v.startTime) : DAY_START;
        const endDec = hasTimes ? timeToDecimal(v.endTime) : DAY_START + 0.5;
        const top = (startDec - DAY_START) * HOUR_HEIGHT;
        const height = (endDec - startDec) * HOUR_HEIGHT;
        const statusClass =
          v.status === "rejected"
            ? "bg-muted/40 border-muted-foreground/30 opacity-60"
            : v.status === "pending"
              ? "bg-status-progress/10 border-dashed border-status-progress/60"
              : offReasonStyle.vacation;
        return (
          <div
            key={`vac-${v.id}`}
            className={cn(
              "absolute inset-x-0.5 overflow-hidden rounded-md border px-1 py-0.5 shadow-sm",
              statusClass,
              canRequestVacation && "cursor-pointer hover:opacity-90",
            )}
            style={{
              top: hasTimes ? top : 1,
              height: hasTimes ? Math.max(height, 18) : 16,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onEditVacation(v);
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
}
