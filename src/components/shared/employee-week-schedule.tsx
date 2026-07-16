import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarClock,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plane,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, formatTimeRange } from "@/lib/utils";
import { api, type Paginated } from "@/lib/api";
import {
  beirutDayKey,
  beirutNow,
  dateRangeToUtc,
  formatInBeirut,
} from "@/lib/tz";
import { format as fnsFormat } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { EmployeeScheduleForm } from "@/components/forms/employee-schedule-form";
import { EmployeeScheduleChangeForm } from "@/components/forms/employee-schedule-change-form";
import { AppointmentCard } from "@/components/shared/appointment-card";
import {
  AppointmentForm,
  type AppointmentFormData,
} from "@/components/forms/appointment-form";
import { usePermissions } from "@/hooks/use-permissions";
import type {
  Appointment,
  EmployeeMonthHours,
  EmployeeSchedule,
  EmployeeScheduleChange,
  EmployeeScheduleChangeType,
  EmployeeScheduleDay,
  EmployeeScheduleResponse,
  Holiday,
} from "@/lib/types";

const DAY_START = 8;
const DAY_END = 20;
const HOUR_HEIGHT = 60;
const MIN_BLOCK = 18;
const HOURS = Array.from(
  { length: DAY_END - DAY_START },
  (_, i) => i + DAY_START,
);
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
const GRID_COLS = `50px 12px repeat(7, 1fr)`;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EMPTY_APPTS: Appointment[] = [];

const REGULAR_STYLE = "bg-primary/10 border-primary/40";
const OVERTIME_STYLE = "bg-status-rescheduled/10 border-status-rescheduled/50";
const PENDING_STYLE = "bg-foreground/5 border-dashed border-foreground/45";
const REJECTED_STYLE = "bg-muted/40 border-muted-foreground/30 opacity-60";

const offReasonStyle: Record<string, string> = {
  holiday: "bg-warning/20 border-warning/50",
  timeoff: "bg-status-completed/20 border-status-completed/55",
  "no-schedule": "bg-muted/30 border-border",
};

const offReasonLabel: Record<string, string> = {
  holiday: "Holiday",
  timeoff: "Time Off",
  "no-schedule": "Off",
};

const pad = (n: number) => String(n).padStart(2, "0");
const hourToTime = (h: number) => `${pad(h)}:00`;
const formatHour = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const timeToDecimal = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
};
const formatHours = (n: number) =>
  Number.isInteger(n) ? `${n}` : n.toFixed(1).replace(/\.0$/, "");

// Keep blocks inside the visible window so out-of-range times don't add scroll.
function blockBounds(startDec: number, endDec: number) {
  const rawTop = (startDec - DAY_START) * HOUR_HEIGHT;
  const rawHeight = (endDec - startDec) * HOUR_HEIGHT;
  const top = Math.min(Math.max(rawTop, 0), GRID_HEIGHT - MIN_BLOCK);
  const height = Math.min(Math.max(rawHeight, MIN_BLOCK), GRID_HEIGHT - top);
  return { top, height };
}

type AppointmentDayWindow = {
  startMs: number;
  endMs: number;
  startHour: number;
};

function appointmentDayWindow(date: string): AppointmentDayWindow {
  const { from, to } = dateRangeToUtc(date, date);
  return {
    startMs: Date.parse(from),
    endMs: Date.parse(to),
    startHour: timeToDecimal(formatInBeirut(from, "HH:mm")),
  };
}

function appointmentBoundsInDay(
  appointment: Appointment,
  day: AppointmentDayWindow,
): { start: number; end: number } | null {
  const startMs = Date.parse(appointment.startTime);
  const endMs = Date.parse(appointment.endTime);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs ||
    startMs >= day.endMs ||
    endMs <= day.startMs
  ) {
    return null;
  }

  const visibleStartMs = Math.max(startMs, day.startMs);
  const visibleEndMs = Math.min(endMs, day.endMs);
  const start =
    day.startHour + (visibleStartMs - day.startMs) / 3_600_000;
  const end = day.startHour + (visibleEndMs - day.startMs) / 3_600_000;
  return end > start ? { start, end } : null;
}

type AppointmentBlockBounds = {
  top: number;
  height: number;
  edge?: "before" | "after";
};

function appointmentBlockBounds(
  appointment: Appointment,
  date: string,
): AppointmentBlockBounds | null {
  const bounds = appointmentBoundsInDay(
    appointment,
    appointmentDayWindow(date),
  );
  if (!bounds) return null;

  // The compact employee grid remains focused on working hours. Keep
  // entirely off-hours appointments visible as edge indicators instead of
  // dropping them from the schedule.
  if (bounds.end <= DAY_START) {
    return { top: 0, height: MIN_BLOCK, edge: "before" };
  }
  if (bounds.start >= DAY_END) {
    return {
      top: GRID_HEIGHT - MIN_BLOCK,
      height: MIN_BLOCK,
      edge: "after",
    };
  }

  const start = Math.max(bounds.start, DAY_START);
  const end = Math.min(bounds.end, DAY_END);

  const rawTop = (start - DAY_START) * HOUR_HEIGHT;
  const rawHeight = (end - start) * HOUR_HEIGHT;
  const height = Math.min(Math.max(rawHeight, MIN_BLOCK), GRID_HEIGHT);
  return {
    top: Math.min(rawTop, GRID_HEIGHT - height),
    height,
  };
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  // Week starts on Monday; Sunday (0) is the last day.
  const diff = r.getDay() === 0 ? 6 : r.getDay() - 1;
  r.setDate(r.getDate() - diff);
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

type ScheduleState = {
  days: EmployeeScheduleDay[];
  templates: EmployeeSchedule[];
  scheduleChanges: EmployeeScheduleChange[];
  holidays: Holiday[];
  monthStart: string;
  monthHours: EmployeeMonthHours[];
  appointments: Appointment[];
};

const emptySchedule: ScheduleState = {
  days: [],
  templates: [],
  scheduleChanges: [],
  holidays: [],
  monthStart: "",
  monthHours: [],
  appointments: [],
};

type GenForm =
  | { open: false }
  | { open: true; mode: "add"; day: number; start: string; end: string }
  | { open: true; mode: "edit"; slot: EmployeeSchedule };

type ChangeForm =
  | { open: false }
  | {
      open: true;
      mode: "add";
      changeType: EmployeeScheduleChangeType;
      date?: string;
      start?: string;
      end?: string;
    }
  | { open: true; mode: "edit"; change: EmployeeScheduleChange };

const closedGen: GenForm = { open: false };
const closedChange: ChangeForm = { open: false };

export function EmployeeWeekSchedule({
  employeeId,
  canEditGeneral,
  canRequestChange,
}: {
  employeeId: string;
  canEditGeneral: boolean;
  canRequestChange: boolean;
}) {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const canReadAppointments = can("appointments:read");
  const canWriteAppointments = can("appointments:write");

  const [weekStart, setWeekStart] = useState(() => startOfWeek(beirutNow()));
  const [data, setData] = useState<ScheduleState>(emptySchedule);
  const [genForm, setGenForm] = useState<GenForm>(closedGen);
  const [changeForm, setChangeForm] = useState<ChangeForm>(closedChange);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [apptForm, setApptForm] = useState<{
    open: boolean;
    data?: Partial<AppointmentFormData>;
    scheduleDate?: string;
  }>({ open: false });
  const [apptFormKey, setApptFormKey] = useState(0);

  // Drop out-of-order responses.
  const reloadGen = useRef(0);

  const reload = useCallback(async () => {
    const gen = ++reloadGen.current;
    const dateParam = toIsoDate(weekStart);
    try {
      const [res, apptsRes] = await Promise.all([
        api.get<EmployeeScheduleResponse>(
          `/employees/${employeeId}/schedule?date=${dateParam}`,
        ),
        canReadAppointments
          ? api
              .get<
                Paginated<Appointment> | Appointment[]
              >(`/employees/${employeeId}/appointments?date=${dateParam}`)
              .catch(() => [] as Appointment[])
          : Promise.resolve<Appointment[]>([]),
      ]);
      if (gen !== reloadGen.current) return;
      const appointments = Array.isArray(apptsRes)
        ? apptsRes
        : (apptsRes.items ?? []);
      setData({
        days: res.days ?? [],
        templates: res.templates ?? [],
        scheduleChanges: res.scheduleChanges ?? [],
        holidays: res.holidays ?? [],
        monthStart: res.monthStart ?? "",
        monthHours: res.monthHours ?? [],
        // Match the calendar: replaced appointment records are history and
        // should not occupy time on the active schedule.
        appointments: appointments.filter(
          (appointment) => appointment.status !== "Rescheduled",
        ),
      });
    } catch {
      if (gen !== reloadGen.current) return;
      setData(emptySchedule);
    }
  }, [employeeId, weekStart, canReadAppointments]);

  useEffect(() => {
    reload();
  }, [reload]);

  const weekDates = useMemo(() => {
    // weekStart is the Monday; display the surrounding Sun-to-Sat calendar so the
    // work week (Mon–Fri) is centered. The Monday is still what's sent to the API.
    const start = addDays(startOfWeek(weekStart), -1);
    return DAYS.map((label, i) => {
      const date = addDays(start, i);
      // dayOfWeek follows JS dates (0 = Sunday), independent of column order.
      return { dayOfWeek: date.getDay(), label, date, iso: toIsoDate(date) };
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

  // Multi-day changes can be edited from any covered day.
  const changesByDate = useMemo(() => {
    const map: Record<string, EmployeeScheduleChange[]> = {};
    for (const c of data.scheduleChanges) {
      const start = c.startDate?.slice(0, 10);
      const end = c.endDate?.slice(0, 10) || start;
      if (!start) continue;
      let cursor = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);
      while (cursor.getTime() <= endDate.getTime()) {
        (map[toIsoDate(cursor)] ??= []).push(c);
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [data.scheduleChanges]);

  const holidayByDate = useMemo(() => {
    const map: Record<string, Holiday> = {};
    for (const h of data.holidays) {
      const start = h.startDate?.slice(0, 10);
      const end = h.endDate?.slice(0, 10) || start;
      if (!start) continue;
      let cursor = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);
      while (cursor.getTime() <= endDate.getTime()) {
        map[toIsoDate(cursor)] = h;
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [data.holidays]);

  // Bucket by interval overlap, not just start date. A cross-midnight
  // appointment therefore appears (clipped) in both Beirut day columns.
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const day of weekDates) {
      const window = appointmentDayWindow(day.iso);
      const seen = new Set<string>();
      for (const appointment of data.appointments) {
        if (
          seen.has(appointment.id) ||
          !appointmentBoundsInDay(appointment, window)
        ) {
          continue;
        }
        seen.add(appointment.id);
        (map[day.iso] ??= []).push(appointment);
      }
      map[day.iso]?.sort(
        (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
      );
    }
    return map;
  }, [data.appointments, weekDates]);

  const todayIso = toIsoDate(beirutNow());

  const headerLabel = useMemo(() => {
    const first = weekDates[0]?.date;
    const last = weekDates[6]?.date;
    if (!first || !last) return "";
    // weekDates Dates are Beirut-anchored via beirutNow(); read local fields
    // directly with date-fns format to keep wall-clock interpretation.
    const fmt = (d: Date) => fnsFormat(d, "d MMM");
    return `${fmt(first)} - ${fmt(last)} ${last.getFullYear()}`;
  }, [weekDates]);

  const monthLabel = useMemo(() => {
    if (!data.monthStart) return "";
    const d = new Date(`${data.monthStart}T00:00:00`);
    return fnsFormat(d, "MMMM yyyy");
  }, [data.monthStart]);

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
  const openEditSlot = (slot: EmployeeSchedule) => {
    if (!canEditGeneral) return;
    setGenForm({ open: true, mode: "edit", slot });
  };
  const openAddChange = (
    changeType: EmployeeScheduleChangeType,
    date?: string,
    hour?: number,
  ) => {
    if (!canRequestChange) return;
    setChangeForm({
      open: true,
      mode: "add",
      changeType,
      date,
      start: hour !== undefined ? hourToTime(hour) : undefined,
      end: hour !== undefined ? hourToTime(hour + 1) : undefined,
    });
  };
  const openEditChange = (change: EmployeeScheduleChange) => {
    if (!canRequestChange) return;
    setChangeForm({ open: true, mode: "edit", change });
  };

  // Mirror the calendar: open the full appointment form so the card keeps all
  // its functionality (status transitions, completion wizard, etc.).
  const openAppointment = (appt: Appointment) => {
    if (!canWriteAppointments) return;
    setApptForm({
      open: true,
      data: {
        id: appt.id,
        patientId: appt.patientId,
        patientLabel: appt.patientName,
        roomId: appt.roomId,
        procedures:
          appt.appointmentProcedures?.map((ap) => ({
            id: ap.procedureId,
            label: ap.procedureName ?? "",
            assignedToId: ap.assignedToId || undefined,
            assignedToLabel: ap.assignedToName || undefined,
          })) ?? [],
        date: beirutDayKey(appt.startTime),
        endDate: beirutDayKey(appt.endTime),
        startTime: appt.startTime,
        endTime: appt.endTime,
        status: appt.status,
        notes: appt.notes,
        cancelNotes: appt.cancelNotes,
        completionNotes: appt.completionNotes,
      },
      scheduleDate: beirutDayKey(appt.startTime),
    });
    setApptFormKey((k) => k + 1);
  };

  const genAdd = genForm.open && genForm.mode === "add" ? genForm : null;
  const genEdit = genForm.open && genForm.mode === "edit" ? genForm : null;
  const changeAdd =
    changeForm.open && changeForm.mode === "add" ? changeForm : null;
  const changeEdit =
    changeForm.open && changeForm.mode === "edit" ? changeForm : null;

  const monthEntry =
    data.monthHours.find((m) => m.employeeId === employeeId) ??
    data.monthHours[0];
  const totalHours = monthEntry ? Math.max(0, monthEntry.hours) : 0;
  const overtimeHours = monthEntry ? Math.max(0, monthEntry.overtimeHours) : 0;
  const regularHours = Math.max(0, totalHours - overtimeHours);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-32 space-y-1">
          <CardTitle className="text-base">Schedule</CardTitle>
          {monthEntry && monthLabel && (
            <p className="text-xs text-muted-foreground">
              {monthLabel}: {formatHours(totalHours)}h total
              {overtimeHours > 0 && (
                <>
                  {" "}
                  ({formatHours(regularHours)}h regular +{" "}
                  <span className="text-status-rescheduled">
                    {formatHours(overtimeHours)}h OT
                  </span>
                  )
                </>
              )}
            </p>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
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
            onClick={() => setWeekStart(startOfWeek(beirutNow()))}
            title="Go to this week"
          >
            <RotateCcw className="size-4" />
          </Button>
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
              {weekDates.map((day) => {
                const projected = dayByDate[day.iso];
                const ot = projected?.overtimeHours ?? 0;
                const totalDayHours = projected?.hours ?? 0;
                return (
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
                    {totalDayHours > 0 && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                        {formatHours(totalDayHours)}h
                        {ot > 0 && (
                          <span className="text-status-rescheduled">
                            {" "}
                            +{formatHours(ot)} OT
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                  changes={changesByDate[day.iso] ?? []}
                  holiday={holidayByDate[day.iso]}
                  templates={data.templates}
                  appointments={appointmentsByDate[day.iso] ?? EMPTY_APPTS}
                  canEditGeneral={canEditGeneral}
                  canRequestChange={canRequestChange}
                  onAddSlot={openAddSlot}
                  onRequestChange={openAddChange}
                  onEditSlot={openEditSlot}
                  onEditChange={openEditChange}
                  onAppointmentClick={openAppointment}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>

      <EmployeeScheduleForm
        open={genForm.open}
        onClose={() => setGenForm(closedGen)}
        onSaved={reload}
        employeeId={employeeId}
        initial={genEdit?.slot ?? null}
        defaultDayOfWeek={genAdd?.day}
        defaultStartTime={genAdd?.start}
        defaultEndTime={genAdd?.end}
      />
      <EmployeeScheduleChangeForm
        open={changeForm.open}
        onClose={() => setChangeForm(closedChange)}
        onSaved={reload}
        employeeId={employeeId}
        initial={changeEdit?.change ?? null}
        defaultType={changeAdd?.changeType}
        defaultDate={changeAdd?.date}
        defaultStartTime={changeAdd?.start}
        defaultEndTime={changeAdd?.end}
      />
      <AppointmentForm
        key={apptFormKey}
        open={apptForm.open}
        onClose={() => setApptForm({ open: false })}
        initialData={apptForm.data}
        onSaved={reload}
        readOnly={apptForm.data?.status === "Completed"}
        onOpenInSchedule={
          apptForm.scheduleDate
            ? () =>
                navigate(
                  `/schedule/calendar?date=${apptForm.scheduleDate}`,
                )
            : undefined
        }
      />
    </Card>
  );
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <Chip className={REGULAR_STYLE} label="Working" />
      <Chip className={OVERTIME_STYLE} label="Overtime" />
      <Chip className={offReasonStyle.timeoff} label="Time off" />
      <Chip className={offReasonStyle.holiday} label="Holiday" />
      <Chip className={PENDING_STYLE} label="Pending request" />
    </div>
  );
}

function Chip({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("inline-block size-3 rounded-sm border", className)}
      />
      {label}
    </span>
  );
}

// Solid status block for overtime shifts and change requests (time-off /
// overtime). Regular shifts render as a faint background band instead (see
// DayColumn) so appointments can own the foreground.
function ScheduleBlock({
  top,
  height,
  fillClass,
  onEdit,
  tooltip,
  children,
}: {
  top: number;
  height: number;
  fillClass: string;
  onEdit?: () => void;
  tooltip?: string;
  children: ReactNode;
}) {
  const base = cn(
    "absolute inset-x-0.5 z-10 flex items-center justify-between gap-1 overflow-hidden rounded-md border px-1 py-0.5 text-left shadow-sm",
    fillClass,
  );
  return onEdit ? (
    <button
      type="button"
      title={tooltip}
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      className={cn(base, "cursor-pointer transition-opacity hover:opacity-90")}
      style={{ top, height }}
    >
      {children}
    </button>
  ) : (
    <div
      title={tooltip}
      className={cn(base, "pointer-events-none")}
      style={{ top, height }}
    >
      {children}
    </div>
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
  changes,
  holiday,
  templates,
  appointments,
  canEditGeneral,
  canRequestChange,
  onAddSlot,
  onRequestChange,
  onEditSlot,
  onEditChange,
  onAppointmentClick,
}: {
  day: { dayOfWeek: number; iso: string };
  isToday: boolean;
  projected?: EmployeeScheduleDay;
  changes: EmployeeScheduleChange[];
  holiday?: Holiday;
  templates: EmployeeSchedule[];
  appointments: Appointment[];
  canEditGeneral: boolean;
  canRequestChange: boolean;
  onAddSlot: (dayOfWeek: number, hour: number) => void;
  onRequestChange: (
    type: EmployeeScheduleChangeType,
    date: string,
    hour?: number,
  ) => void;
  onEditSlot: (slot: EmployeeSchedule) => void;
  onEditChange: (change: EmployeeScheduleChange) => void;
  onAppointmentClick: (appt: Appointment) => void;
}) {
  const offReason = projected?.isOff ? projected.offReason : "";
  const showShifts = projected && !offReason && projected.shifts.length > 0;
  const hasCellActions = canEditGeneral || canRequestChange;
  // An hour cell is "inside the schedule" when any shift overlaps it; time off
  // only applies to scheduled hours, overtime only to unscheduled ones.
  const hourInShift = (hour: number) =>
    !!showShifts &&
    projected!.shifts.some(
      (s) =>
        timeToDecimal(s.startTime) < hour + 1 &&
        timeToDecimal(s.endTime) > hour,
    );
  // Regular shifts are edited from the cell
  // menu: find the template slot covering the given hour.
  const editableSlotForHour = (hour: number) => {
    if (!showShifts) return undefined;
    const shift = projected!.shifts.find(
      (s) =>
        s.kind !== "overtime" &&
        timeToDecimal(s.startTime) < hour + 1 &&
        timeToDecimal(s.endTime) > hour,
    );
    if (!shift) return undefined;
    const startDec = timeToDecimal(shift.startTime);
    const endDec = timeToDecimal(shift.endTime);
    return templates.find(
      (t) =>
        t.dayOfWeek === day.dayOfWeek &&
        timeToDecimal(t.startTime) <= startDec &&
        timeToDecimal(t.endTime) >= endDec,
    );
  };
  // Accepted overtime renders as a kind:"overtime" shift; keep it out of the overlay.
  const overlayChanges = changes.filter(
    (c) => !(c.type === "overtime" && c.status === "accepted"),
  );
  const appointmentBlocks: Array<{
    appt: Appointment;
    bounds: AppointmentBlockBounds;
  }> = [];
  for (const appt of appointments) {
    const bounds = appointmentBlockBounds(appt, day.iso);
    if (bounds) appointmentBlocks.push({ appt, bounds });
  }
  const beforeHours = appointmentBlocks.filter(
    ({ bounds }) => bounds.edge === "before",
  );
  const afterHours = appointmentBlocks.filter(
    ({ bounds }) => bounds.edge === "after",
  );

  return (
    <div
      className={cn(
        "relative border-l border-border",
        isToday && "bg-primary/5",
      )}
    >
      {HOURS.map((hour) => {
        const inShift = hourInShift(hour);
        const editSlot =
          canEditGeneral && inShift ? editableSlotForHour(hour) : undefined;
        const cellClass = cn(
          "border-b border-border",
          hasCellActions &&
            "cursor-pointer transition-colors hover:bg-muted/30",
        );
        if (!hasCellActions) {
          return (
            <div
              key={hour}
              className={cellClass}
              style={{ height: HOUR_HEIGHT }}
            />
          );
        }
        return (
          <DropdownMenu key={hour}>
            <DropdownMenuTrigger
              render={
                <div className={cellClass} style={{ height: HOUR_HEIGHT }} />
              }
            />
            <DropdownMenuContent align="start" className="min-w-44">
              {canEditGeneral &&
                (inShift ? (
                  editSlot && (
                    <DropdownMenuItem onClick={() => onEditSlot(editSlot)}>
                      <CalendarClock />
                      Edit shift
                    </DropdownMenuItem>
                  )
                ) : (
                  <DropdownMenuItem
                    onClick={() => onAddSlot(day.dayOfWeek, hour)}
                  >
                    <CalendarClock />
                    Modify schedule
                  </DropdownMenuItem>
                ))}
              {canRequestChange &&
                (inShift ? (
                  <DropdownMenuItem
                    onClick={() => onRequestChange("timeoff", day.iso, hour)}
                  >
                    <Plane />
                    Request time off
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onRequestChange("overtime", day.iso, hour)}
                  >
                    <Clock />
                    Request overtime
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}

      {/* Regular shifts are a faint background band (edited via the cell menu);
          overtime shifts stay solid and edit their change. */}
      {showShifts &&
        projected!.shifts.map((shift, i) => {
          const startDec = timeToDecimal(shift.startTime);
          const endDec = timeToDecimal(shift.endTime);
          const { top, height } = blockBounds(startDec, endDec);
          const isOvertime = shift.kind === "overtime";
          if (!isOvertime) {
            return (
              <div
                key={`shift-${i}`}
                className={cn(
                  "pointer-events-none absolute inset-x-0.5 overflow-hidden rounded-md border",
                  REGULAR_STYLE,
                )}
                style={{ top, height }}
              />
            );
          }
          const otChange = changes.find(
            (c) =>
              c.type === "overtime" &&
              c.status === "accepted" &&
              c.startTime?.slice(0, 5) === shift.startTime.slice(0, 5) &&
              c.endTime?.slice(0, 5) === shift.endTime.slice(0, 5),
          );
          return (
            <ScheduleBlock
              key={`shift-${i}`}
              top={top}
              height={height}
              fillClass={OVERTIME_STYLE}
              onEdit={
                canRequestChange && otChange
                  ? () => onEditChange(otChange)
                  : undefined
              }
            >
              <span className="truncate text-xs font-medium">
                {formatTimeRange(shift.startTime, shift.endTime)}
                <span className="ml-1 text-[10px] opacity-75">OT</span>
              </span>
            </ScheduleBlock>
          );
        })}

      {/* Time-off off-days suppress the badge (the overlay below shows them). */}
      {offReason && offReason !== "timeoff" && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0.5 top-0.5 flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-0.5",
            offReasonStyle[offReason],
          )}
        >
          <Badge variant="outline" className="h-4 px-1 text-[10px] capitalize">
            {offReasonLabel[offReason] ?? offReason}
          </Badge>
          {offReason === "holiday" && holiday?.name && (
            <span className="line-clamp-2 px-1 text-center text-[10px] text-foreground/80">
              {holiday.name}
            </span>
          )}
        </div>
      )}

      {overlayChanges.map((c) => {
        const hasTimes = !!c.startTime && !!c.endTime;
        const isOvertime = c.type === "overtime";
        const bounds = hasTimes
          ? blockBounds(timeToDecimal(c.startTime), timeToDecimal(c.endTime))
          : { top: 1, height: 16 };
        const statusClass =
          c.status === "rejected"
            ? REJECTED_STYLE
            : c.status === "pending"
              ? PENDING_STYLE
              : offReasonStyle.timeoff;
        const typeLabel = isOvertime ? "Overtime" : "Time Off";
        return (
          <ScheduleBlock
            key={`chg-${c.id}`}
            top={bounds.top}
            height={bounds.height}
            fillClass={statusClass}
            onEdit={canRequestChange ? () => onEditChange(c) : undefined}
            tooltip={`${c.status} ${typeLabel.toLowerCase()}${c.notes ? ` — ${c.notes}` : ""}`}
          >
            <span
              className={cn(
                "truncate text-xs font-medium",
                c.status === "rejected" && "line-through",
              )}
            >
              {hasTimes ? formatTimeRange(c.startTime, c.endTime) : typeLabel}
              {hasTimes && !isOvertime && (
                <span className="ml-1 text-[10px] opacity-75">Time Off</span>
              )}
            </span>
            {c.status !== "accepted" && (
              <Badge
                variant="outline"
                className="h-4 px-1 text-[10px] capitalize"
              >
                {c.status}
              </Badge>
            )}
          </ScheduleBlock>
        );
      })}

      {/* Appointments sit on top of everything (z-20). */}
      {appointmentBlocks.map(({ appt, bounds }) => {
        const edgeGroup =
          bounds.edge === "before"
            ? beforeHours
            : bounds.edge === "after"
              ? afterHours
              : null;
        const edgeIndex = edgeGroup?.findIndex(
          ({ appt: edgeAppt }) => edgeAppt.id === appt.id,
        );
        const edgeWidth = edgeGroup?.length ? 100 / edgeGroup.length : 100;
        const { edge: _edge, ...position } = bounds;
        const style = edgeGroup
          ? {
              ...position,
              left: `${(edgeIndex ?? 0) * edgeWidth}%`,
              width: `${edgeWidth}%`,
            }
          : position;
        return (
          <AppointmentCard
            key={appt.id}
            appt={appt}
            className="z-20"
            style={style}
            onClick={onAppointmentClick}
          />
        );
      })}
    </div>
  );
}
