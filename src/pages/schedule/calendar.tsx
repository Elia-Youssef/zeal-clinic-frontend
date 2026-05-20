import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { format as fnsFormat } from "date-fns";
import { cn } from "@/lib/utils";
import { beirutNow, formatInBeirut } from "@/lib/tz";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs } from "@/components/shared/tabs";
import {
  AppointmentForm,
  type AppointmentFormData,
} from "@/components/forms/appointment-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useAppointmentsStore } from "@/lib/stores/appointments-store";
import { useRoomsStore } from "@/lib/stores/rooms-store";
import type { Appointment } from "@/lib/types";
import { DayView } from "./components/day-view";
import { WeekView } from "./components/week-view";
import { getWeekDays, padHour, toDateStr } from "./components/sched-utils";

type View = "Day" | "Week";

function parseDateParam(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function CalendarPageContent() {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>("Day");
  const [currentDate, setCurrentDate] = useState<Date>(
    () => parseDateParam(searchParams.get("date")) ?? beirutNow(),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [formData, setFormData] = useState<
    Partial<AppointmentFormData> | undefined
  >();
  const { can } = usePermissions();

  const rooms = useRoomsStore((s) => s.rooms);
  const fetchRooms = useRoomsStore((s) => s.fetch);
  const appointments = useAppointmentsStore((s) => s.appointments);
  const dayHolidays = useAppointmentsStore((s) => s.dayHolidays);
  const weekCounts = useAppointmentsStore((s) => s.weekCounts);
  const weekHolidays = useAppointmentsStore((s) => s.weekHolidays);
  const loading = useAppointmentsStore((s) => s.loading);
  const fetchAppointments = useAppointmentsStore((s) => s.fetchForDates);
  const fetchWeekCounts = useAppointmentsStore((s) => s.fetchWeekCounts);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const reloadAppointments = useCallback(() => {
    const dateStr = toDateStr(currentDate);
    if (view === "Week") fetchWeekCounts(dateStr);
    else fetchAppointments([dateStr]);
  }, [currentDate, view, fetchAppointments, fetchWeekCounts]);

  useEffect(() => {
    reloadAppointments();
  }, [reloadAppointments]);

  useDateSearchParamSync(currentDate, searchParams);

  const navigate = useCallback(
    (direction: -1 | 1) =>
      setCurrentDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + (view === "Week" ? 7 : 1) * direction);
        return next;
      }),
    [view],
  );

  const goToToday = useCallback(() => setCurrentDate(beirutNow()), []);

  const handleWeekDayClick = useCallback((day: Date) => {
    setCurrentDate(day);
    setView("Day");
  }, []);

  const openForm = useCallback((data: Partial<AppointmentFormData>) => {
    setFormData(data);
    setFormKey((k) => k + 1);
    setModalOpen(true);
  }, []);

  const handleCellClick = useCallback(
    (roomId: string, hour: number) => {
      if (!can("appointments:write")) return;
      const dateStr = toDateStr(currentDate);
      openForm({
        roomId,
        startTime: `${dateStr}T${padHour(hour)}:00`,
        endTime: `${dateStr}T${padHour(hour + 1)}:00`,
        status: "Scheduled",
      });
    },
    [can, currentDate, openForm],
  );

  const handleAppointmentClick = useCallback(
    (appt: Appointment) => {
      if (!can("appointments:write")) return;
      openForm({
        id: appt.id,
        patientId: appt.patientId,
        patientLabel: appt.patientName,
        roomId: appt.roomId,
        procedures:
          appt.appointmentProcedures?.map((ap) => ({
            id: ap.procedureId,
            label: ap.procedureName ?? "",
          })) ?? [],
        startTime: formatInBeirut(appt.startTime, "yyyy-MM-dd'T'HH:mm"),
        endTime: formatInBeirut(appt.endTime, "yyyy-MM-dd'T'HH:mm"),
        status: appt.status,
        notes: appt.notes,
        cancelNotes: appt.cancelNotes,
        completionNotes: appt.completionNotes,
      });
    },
    [can, openForm],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <Tabs
            tabs={["Day", "Week"]}
            activeTab={view}
            onChange={(tab) => setView(tab as View)}
          />
          <NavigationControls
            view={view}
            currentDate={currentDate}
            loading={loading}
            onNavigate={navigate}
            onPickDate={setCurrentDate}
            onGoToToday={goToToday}
          />
        </CardHeader>

        <CardContent>
          {/* Keep the grid mounted; loading only dims content. */}
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
                holidays={dayHolidays}
                onCellClick={handleCellClick}
                onAppointmentClick={handleAppointmentClick}
              />
            ) : (
              <WeekView
                date={currentDate}
                rooms={rooms}
                weekCounts={weekCounts}
                holidays={weekHolidays}
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
        readOnly={formData?.status === "Completed"}
      />
    </div>
  );
}

// Sync `?date=YYYY-MM-DD`; omit today.
function useDateSearchParamSync(currentDate: Date, searchParams: URLSearchParams) {
  useEffect(() => {
    const today = toDateStr(beirutNow());
    const current = toDateStr(currentDate);
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
}

function NavigationControls({
  view,
  currentDate,
  loading,
  onNavigate,
  onPickDate,
  onGoToToday,
}: {
  view: View;
  currentDate: Date;
  loading: boolean;
  onNavigate: (direction: -1 | 1) => void;
  onPickDate: (date: Date) => void;
  onGoToToday: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const dateLabel = useMemo(() => {
    // currentDate carries Beirut wall-clock in its local fields; date-fns
    // format reads those directly so we don't shift through the browser zone.
    if (view === "Day") return fnsFormat(currentDate, "d MMM yyyy");
    const days = getWeekDays(currentDate);
    const fmt = (d: Date) => fnsFormat(d, "d MMM");
    return `${fmt(days[0])} - ${fmt(days[6])}`;
  }, [view, currentDate]);

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
      {loading && (
        <Loader2 className="size-4 mr-2 animate-spin text-muted-foreground" />
      )}
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={() => onNavigate(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
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
                onPickDate(date);
                setPickerOpen(false);
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
        onClick={() => onNavigate(1)}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={onGoToToday}
        title={view === "Day" ? "Go to today" : "Go to this week"}
      >
        <RotateCcw className="size-4" />
      </Button>
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
