"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, memo } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs } from "@/components/shared/tabs";
import {
  AppointmentForm,
  type AppointmentFormData,
} from "@/components/forms/appointment-form";
import { useRoomsStore } from "@/lib/stores/rooms-store";
import { useAppointmentsStore } from "@/lib/stores/appointments-store";
import type { Appointment, Room, RoomDayCount } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";

const DAY_START_HOUR = 8; // inclusive: first hour on the grid
const DAY_END_HOUR = 20; // exclusive: last hour row ends here
const HOUR_HEIGHT = 120; // px per hour slot
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => i + DAY_START_HOUR,
);
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
const gridColsFor = (roomCount: number) =>
  `50px 12px repeat(${roomCount}, 1fr)`;

// Helpers

class SchedUtils {
  /** "2026-03-28T09:30:00" to "2026-03-28" */
  static isoToDate(iso: string) {
    return iso.slice(0, 10);
  }

  /** "2026-03-28T09:30:00" to "09:30" */
  static isoToTime(iso: string) {
    return iso.slice(11, 16);
  }

  static formatHour(hour: number) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h} ${ampm}`;
  }

  static timeToDecimal(time: string) {
    const [h, m] = time.split(":").map(Number);
    return h + m / 60;
  }

  static toDateStr(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  static getWeekStart(date: Date) {
    // Week starts on Monday. getDay() returns 0 for Sunday, 1 for Monday…
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d;
  }

  static getWeekDays(date: Date) {
    const start = SchedUtils.getWeekStart(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  static padHour(hour: number) {
    return String(hour).padStart(2, "0");
  }
}

// Appointment status styles
const statusStyles: Record<string, { card: string; badge: string }> = {
  Scheduled: {
    card: "bg-primary/10 border-primary/30",
    badge: "bg-primary text-primary-foreground",
  },
  "In-Progress": {
    card: "bg-yellow-500/10 border-yellow-500/30",
    badge: "bg-yellow-500 text-white",
  },
  Completed: {
    card: "bg-green-700/10 border-green-500/30",
    badge: "bg-green-700 text-white",
  },
  Cancelled: {
    card: "bg-gray-500/10 border-gray-500/30",
    badge: "bg-gray-500 text-white",
  },
};
const DEFAULT_STATUS_STYLE = {
  card: "bg-muted/10 border-muted/30",
  badge: "bg-muted text-white",
};

const EMPTY_APPTS: Appointment[] = [];

// Static grid pieces (memoized, render once)

const TimeLabelsColumn = memo(function TimeLabelsColumn() {
  return (
    <div className="relative" style={{ height: GRID_HEIGHT }}>
      {HOURS.map((hour, i) => (
        <div
          key={hour}
          className="absolute left-2 -translate-y-1/2 text-xs text-muted-foreground"
          style={{ top: i * HOUR_HEIGHT }}
        >
          {i ? SchedUtils.formatHour(hour) : ""}
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
          style={{ height: HOUR_HEIGHT }}
        />
      ))}
    </div>
  );
});

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

// Appointment card

function AppointmentCard({
  appt,
  onClick,
}: {
  appt: Appointment;
  onClick: (appt: Appointment) => void;
}) {
  const startTime = SchedUtils.isoToTime(appt.startTime);
  const endTime = SchedUtils.isoToTime(appt.endTime);
  const startDec = SchedUtils.timeToDecimal(startTime);
  const endDec = SchedUtils.timeToDecimal(endTime);
  const top = (startDec - DAY_START_HOUR) * HOUR_HEIGHT;
  const height = (endDec - startDec) * HOUR_HEIGHT;
  const style = statusStyles[appt.status] ?? DEFAULT_STATUS_STYLE;

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
            style={{ top, height }}
            onClick={(e) => {
              e.stopPropagation();
              onClick(appt);
            }}
          />
        }
      >
        <div className="truncate text-xs font-medium px-1 pt-1">
          {appt.patientName || "Unknown Patient"}
        </div>
        {appt.patientProcedure && (
          <div className="truncate text-xs opacity-80 px-1">
            {appt.patientProcedure.procedureName}
          </div>
        )}
        <div
          className={cn(
            "text-[10px] font-medium self-end px-1 py-0.5 rounded-tl-sm",
            style.badge,
          )}
        >
          {appt.status}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/patients/${appt.patientId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-heading font-medium leading-tight hover:underline"
          >
            {appt.patientName || "Unknown Patient"}
          </Link>
          <Badge className={cn("shrink-0", style.badge)}>{appt.status}</Badge>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-y-1 text-xs">
          <span className="text-muted-foreground">Time</span>
          <span>
            {startTime} – {endTime}
          </span>
          {appt.patientProcedure?.procedureName && (
            <>
              <span className="text-muted-foreground">Procedure</span>
              <span className="truncate">
                {appt.patientProcedure.procedureName}
              </span>
            </>
          )}
          {appt.notes && (
            <>
              <span className="text-muted-foreground">Notes</span>
              <span className="whitespace-pre-wrap wrap-break-word">
                {appt.notes}
              </span>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// Single room column (empty cells + appointments)

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
          style={{ height: HOUR_HEIGHT }}
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

// Current-time indicator (self-contained, ticks every minute)

function CurrentTimeLine({ dateStr }: { dateStr: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (SchedUtils.toDateStr(now) !== dateStr) return null;
  const decimal = now.getHours() + now.getMinutes() / 60;
  if (decimal < DAY_START_HOUR || decimal > DAY_END_HOUR) return null;

  return (
    <div
      className="pointer-events-none absolute left-12.5 right-0 z-10"
      style={{ top: (decimal - DAY_START_HOUR) * HOUR_HEIGHT }}
    >
      <div className="h-2.5 w-2.5 bg-red-600 absolute -translate-y-1/2 top-px left-0 rounded-2xl" />
      <div className="h-0.5 bg-red-600/60" />
    </div>
  );
}

// Day View

function DayView({
  date,
  rooms,
  appointments,
  onCellClick,
  onAppointmentClick,
}: {
  date: Date;
  rooms: Room[];
  appointments: Appointment[];
  onCellClick: (roomId: string, hour: number) => void;
  onAppointmentClick: (appt: Appointment) => void;
}) {
  const dateStr = SchedUtils.toDateStr(date);

  const appointmentsByRoom = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      if (SchedUtils.isoToDate(a.startTime) !== dateStr) continue;
      (map[a.roomId] ??= []).push(a);
    }
    return map;
  }, [appointments, dateStr]);

  const dayCount = Object.values(appointmentsByRoom).reduce(
    (n, arr) => n + arr.length,
    0,
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold">
          {date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </h2>
        <Badge variant="secondary">
          {dayCount} appointment{dayCount !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-225">
          <RoomHeaders rooms={rooms} />

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

// Week View

function WeekView({
  date,
  rooms,
  weekCounts,
  onDayClick,
}: {
  date: Date;
  rooms: Room[];
  weekCounts: RoomDayCount[];
  onDayClick: (day: Date) => void;
}) {
  const weekDays = SchedUtils.getWeekDays(date);
  const today = SchedUtils.toDateStr(new Date());
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const countsByRoom = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const r of weekCounts) {
      map[r.roomId] = r.days;
    }
    return map;
  }, [weekCounts]);

  const shortDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dayLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short" });
  const weekGridCols = `100px repeat(${rooms.length}, 1fr)`;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {shortDate(weekStart)} - {shortDate(weekEnd)}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-225">
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: weekGridCols }}
          >
            <div className="p-3" />
            {rooms.map((room) => (
              <div
                key={room.id}
                className="border-l border-border p-3 text-center"
              >
                <div className="text-sm font-medium">{room.name}</div>
                <div className="text-xs text-muted-foreground">{room.type}</div>
              </div>
            ))}
          </div>

          {weekDays.map((day) => {
            const dayStr = SchedUtils.toDateStr(day);
            const isToday = dayStr === today;
            return (
              <div
                key={dayStr}
                className={cn(
                  "grid border-b border-border",
                  isToday && "bg-primary/10",
                )}
                style={{ gridTemplateColumns: weekGridCols }}
              >
                <div
                  className={cn(
                    "cursor-pointer p-3 transition-colors hover:bg-muted/50",
                    isToday && "font-semibold",
                  )}
                  onClick={() => onDayClick(day)}
                >
                  <div className="text-sm">{dayLabel(day)}</div>
                  <div className="text-xs text-muted-foreground">
                    {shortDate(day)}
                  </div>
                </div>
                {rooms.map((room) => {
                  const count = countsByRoom[room.id]?.[dayStr] ?? 0;
                  return (
                    <div
                      key={room.id}
                      className="flex items-center justify-center border-l border-border p-3"
                    >
                      {count > 0 ? (
                        <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Main Schedule Page

function parseDateParam(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function CalendarPageContent() {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<"Day" | "Week">("Day");
  const [currentDate, setCurrentDate] = useState<Date>(
    () => parseDateParam(searchParams.get("date")) ?? new Date(),
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [formData, setFormData] = useState<
    Partial<AppointmentFormData> | undefined
  >();
  const { can } = usePermissions();

  const rooms = useRoomsStore((s) => s.rooms);
  const fetchRooms = useRoomsStore((s) => s.fetch);
  const appointments = useAppointmentsStore((s) => s.appointments);
  const weekCounts = useAppointmentsStore((s) => s.weekCounts);
  const loading = useAppointmentsStore((s) => s.loading);
  const fetchAppointments = useAppointmentsStore((s) => s.fetchForDates);
  const fetchWeekCounts = useAppointmentsStore((s) => s.fetchWeekCounts);

  // Rooms rarely change, so load once. Reloading them on every date navigation
  // would replace the array ref and break memoized grid pieces.
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const reloadAppointments = useCallback(() => {
    const dateStr = SchedUtils.toDateStr(currentDate);
    if (view === "Week") {
      fetchWeekCounts(dateStr);
    } else {
      fetchAppointments([dateStr]);
    }
  }, [currentDate, view, fetchAppointments, fetchWeekCounts]);

  useEffect(() => {
    reloadAppointments();
  }, [reloadAppointments]);

  // Keep `?date=YYYY-MM-DD` in sync with the currently viewed day. When the
  // user lands on "today", drop the param so the URL stays clean. Using
  // history.replaceState avoids a route-level re-render while preserving the URL.
  useEffect(() => {
    const today = SchedUtils.toDateStr(new Date());
    const current = SchedUtils.toDateStr(currentDate);
    const desired = current === today ? null : current;
    if (searchParams.get("date") === desired) return;

    const params = new URLSearchParams(searchParams.toString());
    if (desired) params.set("date", desired);
    else params.delete("date");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [currentDate, searchParams]);

  const navigate = (direction: -1 | 1) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(
        next.getDate() + (view === "Week" ? 7 * direction : direction),
      );
      return next;
    });
  };

  const goToToday = () => setCurrentDate(new Date());

  const dateLabel = useMemo(() => {
    if (view === "Day") {
      return currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    const days = SchedUtils.getWeekDays(currentDate);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(days[0])} - ${fmt(days[6])}`;
  }, [view, currentDate]);

  const handleWeekDayClick = useCallback((day: Date) => {
    setCurrentDate(day);
    setView("Day");
  }, []);

  const openForm = (data: Partial<AppointmentFormData>) => {
    setFormData(data);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  };

  const handleCellClick = useCallback(
    (roomId: string, hour: number) => {
      if (!can("appointments:write")) return;
      const dateStr = SchedUtils.toDateStr(currentDate);
      openForm({
        roomId,
        startTime: `${dateStr}T${SchedUtils.padHour(hour)}:00`,
        endTime: `${dateStr}T${SchedUtils.padHour(hour + 1)}:00`,
        status: "Scheduled",
      });
    },
    [can, currentDate],
  );

  const handleAppointmentClick = useCallback(
    (appt: Appointment) => {
      if (!can("appointments:write")) return;
      openForm({
        id: appt.id,
        patientId: appt.patientId,
        patientLabel: appt.patientName,
        roomId: appt.roomId,
        procedureId: appt.patientProcedure?.id ?? "",
        procedureLabel: appt.patientProcedure?.procedureName ?? "",
        procedureSessionId: appt.patientProcedureSession?.id ?? "",
        startTime: appt.startTime.slice(0, 16),
        endTime: appt.endTime.slice(0, 16),
        status: appt.status,
        notes: appt.notes,
      });
    },
    [can],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <Tabs
            tabs={["Day", "Week"]}
            activeTab={view}
            onChange={(tab) => setView(tab as "Day" | "Week")}
          />

          <div className="flex items-center gap-1">
            {loading && (
              <Loader2 className="size-4 mr-2 animate-spin text-muted-foreground" />
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navigate(-1)}
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
                {dateLabel}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={(date) => {
                    if (date) {
                      setCurrentDate(date);
                      setDatePickerOpen(false);
                    }
                  }}
                  defaultMonth={currentDate}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navigate(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={goToToday}
              title={view === "Day" ? "Go to today" : "Go to this week"}
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Grid stays mounted across date/view changes; only the data
              inside re-renders. Loading shows as a header spinner + dimmed
              content, never a content swap. */}
          <div
            className={cn(
              "transition-opacity",
              loading && "opacity-60 pointer-events-none",
            )}
          >
            {view === "Day" ? (
              <DayView
                date={currentDate}
                rooms={rooms}
                appointments={appointments}
                onCellClick={handleCellClick}
                onAppointmentClick={handleAppointmentClick}
              />
            ) : (
              <WeekView
                date={currentDate}
                rooms={rooms}
                weekCounts={weekCounts}
                onDayClick={handleWeekDayClick}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <AppointmentForm
        key={formKey}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={formData}
        onSaved={reloadAppointments}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent />
    </Suspense>
  );
}
