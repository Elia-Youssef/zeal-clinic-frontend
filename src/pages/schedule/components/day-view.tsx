import { memo, useEffect, useMemo, useRef, useState } from "react";
import { format as fnsFormat } from "date-fns";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { usePermissions } from "@/hooks/use-permissions";
import {
  appointmentStatusStyles,
  defaultAppointmentStatusStyle,
  holidayBadgeClass,
} from "@/lib/constants";
import type { Appointment, Holiday, Room } from "@/lib/types";
import { cn, formatTimeRange } from "@/lib/utils";
import { beirutNow } from "@/lib/tz";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  GRID_HEIGHT,
  HOUR_HEIGHT,
  HOURS,
  formatHour,
  gridColsFor,
  isoToDate,
  isoToTime,
  timeToDecimal,
  toDateStr,
} from "./sched-utils";

const EMPTY_APPTS: Appointment[] = [];

export function DayView({
  date,
  rooms,
  appointments,
  holidays,
  onCellClick,
  onAppointmentClick,
}: {
  date: Date;
  rooms: Room[];
  appointments: Appointment[];
  holidays: Holiday[];
  onCellClick: (roomId: string, hour: number) => void;
  onAppointmentClick: (appt: Appointment) => void;
}) {
  const dateStr = toDateStr(date);
  const scrollRef = useRef<HTMLDivElement>(null);

  useScrollToCurrentTime(scrollRef, dateStr);

  const appointmentsByRoom = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      if (isoToDate(a.startTime) !== dateStr) continue;
      (map[a.roomId] ??= []).push(a);
    }
    return map;
  }, [appointments, dateStr]);

  const dayCount = Object.values(appointmentsByRoom).reduce(
    (n, arr) => n + arr.length,
    0,
  );

  // Store may include neighboring dates after navigation.
  const activeHolidays = useMemo(
    () => holidays.filter((h) => dateStr >= h.startDate && dateStr <= h.endDate),
    [holidays, dateStr],
  );

  return (
    <div>
      <DayHeader date={date} dayCount={dayCount} holidays={activeHolidays} />

      <div
        ref={scrollRef}
        className="overflow-auto max-h-[calc(100svh-18.5rem)]"
      >
        <div className="min-w-225">
          <div className="sticky top-0 z-11 bg-card">
            <RoomHeaders rooms={rooms} />
          </div>

          <div
            className="relative grid"
            style={{ gridTemplateColumns: gridColsFor(rooms.length) }}
          >
            <TimeLabelsColumn />
            <HourLinesColumn />
            {rooms.map((room) => (
              <RoomColumn
                key={room.id}
                roomId={room.id}
                appointments={appointmentsByRoom[room.id] ?? EMPTY_APPTS}
                onCellClick={onCellClick}
                onAppointmentClick={onAppointmentClick}
              />
            ))}
            <CurrentTimeLine dateStr={dateStr} />
          </div>
        </div>
      </div>
    </div>
  );
}

function useScrollToCurrentTime(
  ref: React.RefObject<HTMLDivElement | null>,
  dateStr: string,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const now = beirutNow();
    if (toDateStr(now) !== dateStr) return;
    const decimal = now.getHours() + now.getMinutes() / 60;
    if (decimal < DAY_START_HOUR || decimal > DAY_END_HOUR) return;
    const remPx =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const topPx = (decimal - DAY_START_HOUR) * HOUR_HEIGHT * remPx;
    el.scrollTop = Math.max(0, topPx - el.clientHeight / 2);
  }, [ref, dateStr]);
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
    <div className="mb-4 flex items-center gap-3 flex-wrap">
      <h2 className="text-lg font-semibold">
        {/* date carries Beirut wall-clock via beirutNow(); format from local
            fields rather than re-projecting through the browser zone. */}
        {fnsFormat(date, "EEEE d MMM")}
      </h2>
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

const TimeLabelsColumn = memo(function TimeLabelsColumn() {
  return (
    <div className="relative" style={{ height: `${GRID_HEIGHT}rem` }}>
      {HOURS.map((hour, i) => (
        <div
          key={hour}
          className="absolute left-2 -translate-y-1/2 text-xs text-muted-foreground"
          style={{ top: `${i * HOUR_HEIGHT}rem` }}
        >
          {i ? formatHour(hour) : ""}
        </div>
      ))}
    </div>
  );
});

const HourLinesColumn = memo(function HourLinesColumn() {
  return (
    <div>
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-border"
          style={{ height: `${HOUR_HEIGHT}rem` }}
        />
      ))}
    </div>
  );
});

function RoomColumn({
  roomId,
  appointments,
  onCellClick,
  onAppointmentClick,
}: {
  roomId: string;
  appointments: Appointment[];
  onCellClick: (roomId: string, hour: number) => void;
  onAppointmentClick: (appt: Appointment) => void;
}) {
  return (
    <div className="relative border-l border-border">
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-b border-border transition-colors hover:bg-muted/30 cursor-pointer"
          style={{ height: `${HOUR_HEIGHT}rem` }}
          onClick={() => onCellClick(roomId, hour)}
        />
      ))}
      {appointments.map((appt) => (
        <AppointmentCard
          key={appt.id}
          appt={appt}
          onClick={onAppointmentClick}
        />
      ))}
    </div>
  );
}

function AppointmentCard({
  appt,
  onClick,
}: {
  appt: Appointment;
  onClick: (appt: Appointment) => void;
}) {
  const { can } = usePermissions();
  const startDec = timeToDecimal(isoToTime(appt.startTime));
  const endDec = timeToDecimal(isoToTime(appt.endTime));
  const top = (startDec - DAY_START_HOUR) * HOUR_HEIGHT;
  const height = (endDec - startDec) * HOUR_HEIGHT;
  const style =
    appointmentStatusStyles[appt.status] ?? defaultAppointmentStatusStyle;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        closeDelay={200}
        render={
          <div
            className={cn(
              "absolute cursor-pointer overflow-hidden rounded-md border transition-opacity w-full flex flex-col gap-1 justify-between",
              style.card,
            )}
            style={{ top: `${top}rem`, height: `${height}rem` }}
            onClick={(e) => {
              e.stopPropagation();
              onClick(appt);
            }}
          />
        }
      >
        <div className="flex flex-col">
          <div
            className={cn(
              "truncate text-xs font-medium p-1 text-center",
              style.badge,
            )}
          >
            {appt.patientName || "---"}
          </div>
          <div className="flex flex-col gap-0.5 opacity-80 p-1">
            {appt.appointmentProcedures?.map((p) =>
              p.procedureName ? (
                <Badge
                  key={p.procedureId}
                  variant="secondary"
                  className="text-[0.7em]"
                >
                  {p.procedureName}
                </Badge>
              ) : null,
            )}
          </div>
        </div>
        <div
          className={cn(
            "absolute bottom-0 right-0 text-[0.6em] font-medium px-1 py-0.5 rounded-tl-sm",
            style.badge,
          )}
        >
          {appt.status}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        className="space-y-2 min-w-70 min-h-30 w-fit"
      >
        <div className="flex flex-1 items-start justify-between gap-2">
          {can("patients:read") ? (
            <Link
              to={`/patients/${appt.patientId}`}
              onClick={(e) => e.stopPropagation()}
              className="font-heading font-medium leading-tight hover:underline"
            >
              {appt.patientName || "Unknown Patient"}
            </Link>
          ) : (
            <span className="font-heading font-medium leading-tight">
              {appt.patientName || "Unknown Patient"}
            </span>
          )}
          <Badge className={cn("shrink-0", style.badge)}>{appt.status}</Badge>
        </div>
        <div className="flex-1 grid grid-cols-[7em_1fr] gap-y-1 text-xs">
          <span className="text-muted-foreground">Time</span>
          <span>{formatTimeRange(appt.startTime, appt.endTime)}</span>
          <span className="text-muted-foreground">
            {(appt.appointmentProcedures?.length || 0) > 1
              ? "Procedures"
              : "Procedure"}
          </span>
          <div className="flex flex-col gap-0.5">
            {appt.appointmentProcedures?.map((p) => (
              <Badge key={p.procedureId} variant="secondary">
                {p.procedureName || "---"}
              </Badge>
            ))}
          </div>
          <span className="text-muted-foreground">Notes</span>
          <span className="whitespace-pre-wrap wrap-break-word">
            {appt.notes || "---"}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function CurrentTimeLine({ dateStr }: { dateStr: string }) {
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
      className="pointer-events-none absolute left-12.5 right-0 z-10"
      style={{ top: `${(decimal - DAY_START_HOUR) * HOUR_HEIGHT}rem` }}
    >
      <div className="h-2.5 w-2.5 bg-destructive absolute -translate-y-1/2 top-px left-0 rounded-2xl" />
      <div className="h-0.5 bg-destructive/60" />
    </div>
  );
}
