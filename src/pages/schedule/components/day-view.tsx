import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format as fnsFormat } from "date-fns";
import { Loader2, MoreHorizontal, Plus, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type Column } from "@/components/data/data-table";
import { Tabs } from "@/components/shared/tabs";
import { AppointmentCard } from "@/components/shared/appointment-card";
import { usePermissions } from "@/hooks/use-permissions";
import {
  appointmentStatusStyles,
  defaultAppointmentStatusStyle,
  holidayBadgeClass,
} from "@/lib/constants";
import type { Appointment, Holiday, Room } from "@/lib/types";
import { cn, formatTimeRange, getErrorMessage } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { beirutNow, dateRangeToUtc } from "@/lib/tz";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  GRID_HEIGHT,
  HOUR_HEIGHT,
  HOURS,
  formatHour,
  formatQuarterHour,
  gridColsFor,
  isoToGridMinutes,
  isoToTime,
  timeToDecimal,
  toDateStr,
} from "./sched-utils";
import { DragPreviewCard, DropActionMenu } from "./drag-overlay";
import { useAppointmentDrag, type DragCandidate } from "./use-appointment-drag";
import type { AppointmentDragMode } from "@/components/shared/appointment-card";

const EMPTY_APPTS: Appointment[] = [];

type DayMode = "Calendar" | "Table";

type PendingDrop = { appt: Appointment; candidate: DragCandidate };

type BeirutDayWindow = {
  startTime: string;
  endTime: string;
  startMs: number;
  endMs: number;
  startHour: number;
};

function getBeirutDayWindow(dateStr: string): BeirutDayWindow {
  const { from: startTime, to: endTime } = dateRangeToUtc(dateStr, dateStr);
  return {
    startTime,
    endTime,
    startMs: Date.parse(startTime),
    endMs: Date.parse(endTime),
    // Beirut occasionally advances from 23:59 straight to 01:00. On that
    // date, the first real wall-clock position is 01:00 rather than 00:00.
    startHour: timeToDecimal(isoToTime(startTime)),
  };
}

function appointmentBoundsInDay(
  appointment: Appointment,
  day: BeirutDayWindow,
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
  // Lay out the timeline by elapsed UTC time from the first real Beirut wall
  // hour. Normal days remain 00:00-24:00, a spring gap starts at 01:00, and a
  // fall-back day naturally reaches hour 25 without overlapping the fold.
  const start =
    day.startHour + (visibleStartMs - day.startMs) / 3_600_000;
  const end = day.startHour + (visibleEndMs - day.startMs) / 3_600_000;

  return end > start ? { start, end } : null;
}

function appointmentForDayCollision(
  appointment: Appointment,
  day: BeirutDayWindow,
): Appointment {
  const startMs = Date.parse(appointment.startTime);
  const endMs = Date.parse(appointment.endTime);
  return {
    ...appointment,
    startTime: startMs < day.startMs ? day.startTime : appointment.startTime,
    endTime: endMs > day.endMs ? day.endTime : appointment.endTime,
  };
}

export function DayView({
  date,
  rooms,
  appointments,
  holidays,
  onCellClick,
  onAppointmentClick,
  onAddAppointment,
  onAppointmentsChanged,
}: {
  date: Date;
  rooms: Room[];
  appointments: Appointment[];
  holidays: Holiday[];
  onCellClick: (roomId: string, hour: number) => void;
  onAppointmentClick: (appt: Appointment) => void;
  onAddAppointment: () => void;
  onAppointmentsChanged: () => void;
}) {
  const { can } = usePermissions();
  const addAlert = useAlertStore((s) => s.addAlert);
  const dateStr = toDateStr(date);
  const dayWindow = useMemo(() => getBeirutDayWindow(dateStr), [dateStr]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<DayMode>("Calendar");
  const [printing, setPrinting] = useState(false);
  const [pending, setPending] = useState<PendingDrop | null>(null);

  useEffect(() => setPending(null), [dateStr]);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await api.openPdf(`/appointments/pdf?date=${dateStr}`);
    } catch (err) {
      addAlert("error", getErrorMessage(err, "Failed to generate PDF."));
    } finally {
      setPrinting(false);
    }
  };

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) =>
          appointmentBoundsInDay(appointment, dayWindow),
        )
        .sort(
          (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
        ),
    [appointments, dayWindow],
  );

  const { appointmentsByRoom, collisionAppointmentsByRoom } = useMemo(() => {
    const display: Record<string, Appointment[]> = {};
    const collisions: Record<string, Appointment[]> = {};
    for (const appointment of dayAppointments) {
      (display[appointment.roomId] ??= []).push(appointment);
      (collisions[appointment.roomId] ??= []).push(
        appointmentForDayCollision(appointment, dayWindow),
      );
    }
    return {
      appointmentsByRoom: display,
      collisionAppointmentsByRoom: collisions,
    };
  }, [dayAppointments, dayWindow]);

  const calendarBounds = useMemo(() => {
    let startHour = DAY_START_HOUR;
    let endHour = DAY_END_HOUR;

    for (const appointment of dayAppointments) {
      const bounds = appointmentBoundsInDay(appointment, dayWindow);
      if (!bounds) continue;
      startHour = Math.min(startHour, Math.floor(bounds.start));
      endHour = Math.max(endHour, Math.ceil(bounds.end));
    }

    return {
      startHour,
      beforeScheduleRem: (DAY_START_HOUR - startHour) * HOUR_HEIGHT,
      afterScheduleRem: (endHour - DAY_END_HOUR) * HOUR_HEIGHT,
    };
  }, [dayAppointments, dayWindow]);

  useScrollToCurrentTime(
    scrollRef,
    dateStr,
    mode,
    calendarBounds.beforeScheduleRem,
  );

  const roomNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of rooms) map[r.id] = r.name;
    return map;
  }, [rooms]);

  const dayCount = dayAppointments.length;

  const canWrite = can("appointments:write");
  const handleDrop = useCallback(
    (appt: Appointment, candidate: DragCandidate) =>
      setPending({ appt, candidate }),
    [],
  );
  const { drag, startDrag } = useAppointmentDrag({
    enabled: canWrite && !pending,
    rooms,
    appointmentsByRoom: collisionAppointmentsByRoom,
    gridRef,
    scrollRef,
    scheduleOffsetRem: calendarBounds.beforeScheduleRem,
    onDrop: handleDrop,
  });

  const active = drag ?? pending;

  const activeHolidays = useMemo(
    () =>
      holidays.filter((h) => dateStr >= h.startDate && dateStr <= h.endDate),
    [holidays, dateStr],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <DayHeader date={date} dayCount={dayCount} holidays={activeHolidays} />

        <div className="flex flex-row gap-2 items-center justify-end">
          <Tabs
            tabs={["Calendar", "Table"]}
            activeTab={mode}
            onChange={(tab) => setMode(tab as DayMode)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Day actions"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              className="min-w-40"
            >
              <DropdownMenuItem disabled={printing} onClick={handlePrint}>
                {printing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Printer className="size-4" />
                )}
                <span>Print</span>
              </DropdownMenuItem>
              {can("appointments:write") && mode === "Table" && (
                <DropdownMenuItem onClick={onAddAppointment}>
                  <Plus className="size-4" />
                  <span>Add appointment</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mode === "Calendar" ? (
        <div
          ref={scrollRef}
          className="overflow-auto max-h-[calc(100svh-18.5rem)]"
        >
          <div className="min-w-225">
            <div className="sticky top-0 z-11 bg-card">
              <RoomHeaders rooms={rooms} />
            </div>

            <div
              ref={gridRef}
              className={cn("relative grid", drag && "pointer-events-none")}
              style={{ gridTemplateColumns: gridColsFor(rooms.length) }}
            >
              <TimeLabelsColumn
                beforeScheduleRem={calendarBounds.beforeScheduleRem}
                afterScheduleRem={calendarBounds.afterScheduleRem}
              />
              <HourLinesColumn
                beforeScheduleRem={calendarBounds.beforeScheduleRem}
                afterScheduleRem={calendarBounds.afterScheduleRem}
              />
              {rooms.map((room, i) => (
                <RoomColumn
                  key={room.id}
                  roomId={room.id}
                  dayWindow={dayWindow}
                  appointments={appointmentsByRoom[room.id] ?? EMPTY_APPTS}
                  calendarStartHour={calendarBounds.startHour}
                  beforeScheduleRem={calendarBounds.beforeScheduleRem}
                  afterScheduleRem={calendarBounds.afterScheduleRem}
                  onCellClick={onCellClick}
                  onAppointmentClick={onAppointmentClick}
                  onApptGrab={canWrite ? startDrag : undefined}
                  ghostApptId={
                    active && active.appt.roomId === room.id
                      ? active.appt.id
                      : undefined
                  }
                  overlay={
                    active && active.candidate.roomId === room.id ? (
                      <>
                        <DragPreviewCard
                          appt={active.appt}
                          candidate={active.candidate}
                          roomName={
                            active.candidate.roomId !== active.appt.roomId
                              ? roomNameById[room.id]
                              : undefined
                          }
                        />
                        {pending && !drag && (
                          <DropActionMenu
                            appt={pending.appt}
                            candidate={pending.candidate}
                            dateStr={dateStr}
                            timeChanged={
                              pending.candidate.startMin !==
                                isoToGridMinutes(pending.appt.startTime) ||
                              pending.candidate.endMin !==
                                isoToGridMinutes(pending.appt.endTime)
                            }
                            alignRight={i === rooms.length - 1 && i > 0}
                            onClose={() => setPending(null)}
                            onSaved={() => {
                              setPending(null);
                              onAppointmentsChanged();
                            }}
                          />
                        )}
                      </>
                    ) : undefined
                  }
                />
              ))}
              <CurrentTimeLine
                dateStr={dateStr}
                scheduleOffsetRem={calendarBounds.beforeScheduleRem}
              />
            </div>
          </div>
        </div>
      ) : (
        <DayTable
          appointments={dayAppointments}
          roomNameById={roomNameById}
          onAppointmentClick={onAppointmentClick}
        />
      )}
    </div>
  );
}

function useScrollToCurrentTime(
  ref: React.RefObject<HTMLDivElement | null>,
  dateStr: string,
  mode: DayMode,
  scheduleOffsetRem: number,
) {
  useEffect(() => {
    if (mode !== "Calendar") return;
    const el = ref.current;
    if (!el) return;
    const now = beirutNow();
    if (toDateStr(now) !== dateStr) return;
    const decimal = now.getHours() + now.getMinutes() / 60;
    if (decimal < DAY_START_HOUR || decimal > DAY_END_HOUR) return;
    const remPx =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const topPx =
      (scheduleOffsetRem + (decimal - DAY_START_HOUR) * HOUR_HEIGHT) * remPx;
    el.scrollTop = Math.max(0, topPx - el.clientHeight / 2);
  }, [ref, dateStr, mode, scheduleOffsetRem]);
}

function DayHeader({
  date,
  dayCount,
  holidays,
}: {
  date: Date;
  dayCount: number;
  holidays: Holiday[];
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h2 className="text-lg font-semibold">{fnsFormat(date, "EEEE d MMM")}</h2>
      <Badge variant="secondary">
        {dayCount} appointment{dayCount !== 1 ? "s" : ""}
      </Badge>
      {holidays.map((h) => (
        <Badge
          key={h.id}
          variant="secondary"
          className={holidayBadgeClass}
          title={h.notes || h.name}
        >
          {h.name}
        </Badge>
      ))}
    </div>
  );
}

function DayTable({
  appointments,
  roomNameById,
  onAppointmentClick,
}: {
  appointments: Appointment[];
  roomNameById: Record<string, string>;
  onAppointmentClick: (appt: Appointment) => void;
}) {
  const columns = useMemo<Column<Appointment>[]>(
    () => [
      {
        key: "room",
        header: "Room",
        className: "text-muted-foreground w-20",
        sortable: true,
        sortValue: (a) => roomNameById[a.roomId] ?? "",
        render: (a) => roomNameById[a.roomId] || "---",
      },
      {
        key: "time",
        header: "Time",
        className: "tabular-nums w-42",
        sortable: true,
        sortValue: (a) => Date.parse(a.startTime),
        render: (a) => formatTimeRange(a.startTime, a.endTime),
      },
      {
        key: "patient",
        header: "Patient",
        className: "font-medium w-60",
        sortable: true,
        sortValue: (a) => a.patientName ?? "",
        render: (a) => a.patientName || "---",
      },
      {
        key: "procedures",
        header: "Procedures",
        render: (a) =>
          a.appointmentProcedures?.length ? (
            <div className="flex flex-wrap gap-0.5">
              {a.appointmentProcedures.map((p) => (
                <Badge key={p.procedureId} variant="secondary">
                  {p.procedureName || "---"}
                </Badge>
              ))}
            </div>
          ) : (
            "---"
          ),
      },
      {
        key: "status",
        header: "Status",
        className: "w-32",
        sortable: true,
        sortValue: (a) => a.status,
        render: (a) => {
          const style =
            appointmentStatusStyles[a.status] ?? defaultAppointmentStatusStyle;
          return (
            <Badge className={cn("shrink-0", style.badge)}>{a.status}</Badge>
          );
        },
      },
    ],
    [roomNameById],
  );

  if (appointments.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No appointments for this day.
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={appointments}
      rowKey={(a) => a.id}
      onRowClick={onAppointmentClick}
      scrollable
      maxBodyHeight="max-h-[calc(100svh-18.5rem)]"
    />
  );
}

const RoomHeaders = memo(function RoomHeaders({ rooms }: { rooms: Room[] }) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: gridColsFor(rooms.length) }}
    >
      <div />
      <div className="border-b" />
      {rooms.map((room) => (
        <div
          key={room.id}
          className="border-l border-border p-2 text-center border-b"
        >
          <div className="text-sm font-medium">{room.name}</div>
          <div className="text-xs text-muted-foreground">{room.type}</div>
        </div>
      ))}
    </div>
  );
});

const QUARTERS = [15, 30, 45];

function OutOfScheduleBand({ height }: { height: number }) {
  if (height <= 0) return null;
  return (
    <div
      className="bg-muted/50"
      style={{ height: `${height}rem` }}
      title="Outside schedule"
    />
  );
}

const TimeLabelsColumn = memo(function TimeLabelsColumn({
  beforeScheduleRem,
  afterScheduleRem,
}: {
  beforeScheduleRem: number;
  afterScheduleRem: number;
}) {
  return (
    <div
      className="relative"
      style={{
        height: `${beforeScheduleRem + GRID_HEIGHT + afterScheduleRem}rem`,
      }}
    >
      <OutOfScheduleBand height={beforeScheduleRem} />
      {HOURS.map((hour, i) => (
        <div key={hour}>
          {i || beforeScheduleRem > 0 ? (
            <div
              className="absolute left-2 -translate-y-1/2 text-xs text-muted-foreground"
              style={{ top: `${beforeScheduleRem + i * HOUR_HEIGHT}rem` }}
            >
              {formatHour(hour)}
            </div>
          ) : null}
          {QUARTERS.map((m) => (
            <div
              key={m}
              className="absolute left-2 -translate-y-1/2 text-[0.625rem] text-muted-foreground/50"
              style={{
                top: `${beforeScheduleRem + (i + m / 60) * HOUR_HEIGHT}rem`,
              }}
            >
              {formatQuarterHour(hour, m)}
            </div>
          ))}
        </div>
      ))}
      {afterScheduleRem > 0 && (
        <div
          className="absolute left-2 -translate-y-1/2 text-xs text-muted-foreground"
          style={{ top: `${beforeScheduleRem + GRID_HEIGHT}rem` }}
        >
          {formatHour(DAY_END_HOUR)}
        </div>
      )}
      <div style={{ height: `${GRID_HEIGHT}rem` }} />
      <OutOfScheduleBand height={afterScheduleRem} />
    </div>
  );
});

const HourLinesColumn = memo(function HourLinesColumn({
  beforeScheduleRem,
  afterScheduleRem,
}: {
  beforeScheduleRem: number;
  afterScheduleRem: number;
}) {
  return (
    <div>
      <OutOfScheduleBand height={beforeScheduleRem} />
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-border"
          style={{ height: `${HOUR_HEIGHT}rem` }}
        />
      ))}
      <OutOfScheduleBand height={afterScheduleRem} />
    </div>
  );
});

const RoomColumn = memo(function RoomColumn({
  roomId,
  dayWindow,
  appointments,
  calendarStartHour,
  beforeScheduleRem,
  afterScheduleRem,
  onCellClick,
  onAppointmentClick,
  onApptGrab,
  ghostApptId,
  overlay,
}: {
  roomId: string;
  dayWindow: BeirutDayWindow;
  appointments: Appointment[];
  calendarStartHour: number;
  beforeScheduleRem: number;
  afterScheduleRem: number;
  onCellClick: (roomId: string, hour: number) => void;
  onAppointmentClick: (appt: Appointment) => void;
  onApptGrab?: (
    e: React.PointerEvent,
    appt: Appointment,
    mode: AppointmentDragMode,
  ) => void;
  ghostApptId?: string;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="relative border-l border-border">
      <OutOfScheduleBand height={beforeScheduleRem} />
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-border transition-colors hover:bg-muted/30 cursor-pointer"
          style={{ height: `${HOUR_HEIGHT}rem` }}
          onClick={() => onCellClick(roomId, hour)}
        />
      ))}
      <OutOfScheduleBand height={afterScheduleRem} />
      {appointments.map((appt) => {
        const bounds = appointmentBoundsInDay(appt, dayWindow);
        if (!bounds) return null;
        const top = (bounds.start - calendarStartHour) * HOUR_HEIGHT;
        const height = (bounds.end - bounds.start) * HOUR_HEIGHT;
        const startMs = Date.parse(appt.startTime);
        const endMs = Date.parse(appt.endTime);
        const clipped = startMs < dayWindow.startMs || endMs > dayWindow.endMs;
        const isInsideSchedule =
          !clipped &&
          bounds.start >= DAY_START_HOUR &&
          bounds.end <= DAY_END_HOUR;
        const draggable =
          !!onApptGrab && appt.status !== "Completed" && isInsideSchedule;
        return (
          <AppointmentCard
            key={appt.id}
            appt={appt}
            style={{ top: `${top}rem`, height: `${height}rem` }}
            className={
              appt.id === ghostApptId
                ? "opacity-40 pointer-events-none"
                : undefined
            }
            onClick={onAppointmentClick}
            onGrab={
              draggable ? (e, mode) => onApptGrab!(e, appt, mode) : undefined
            }
          />
        );
      })}
      {overlay && (
        <div
          className="absolute inset-x-0"
          style={{
            top: `${beforeScheduleRem}rem`,
            height: `${GRID_HEIGHT}rem`,
          }}
        >
          {overlay}
        </div>
      )}
    </div>
  );
});

function CurrentTimeLine({
  dateStr,
  scheduleOffsetRem,
}: {
  dateStr: string;
  scheduleOffsetRem: number;
}) {
  const [now, setNow] = useState(() => beirutNow());

  useEffect(() => {
    const id = setInterval(() => setNow(beirutNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (toDateStr(now) !== dateStr) return null;
  const decimal = now.getHours() + now.getMinutes() / 60;
  if (decimal < DAY_START_HOUR || decimal > DAY_END_HOUR) return null;

  return (
    <div
      className="pointer-events-none absolute left-13.5 right-0 z-10"
      style={{
        top: `${scheduleOffsetRem + (decimal - DAY_START_HOUR) * HOUR_HEIGHT}rem`,
      }}
    >
      <div className="h-2.5 w-2.5 bg-destructive absolute -translate-y-1/2 top-px left-0 rounded-2xl" />
      <div className="h-0.5 bg-destructive/60" />
    </div>
  );
}
