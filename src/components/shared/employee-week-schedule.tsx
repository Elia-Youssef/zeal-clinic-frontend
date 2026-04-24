"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleAvailabilityForm } from "@/components/forms/schedule-availability-form";
import type { ScheduleAvailability } from "@/lib/types";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 60;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => i + DAY_START_HOUR,
);
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
const GRID_COLS = `50px 12px repeat(7, 1fr)`;

// API day-of-week convention: 1 = Monday … 7 = Sunday.
const DAYS: { api: number; label: string }[] = [
  { api: 1, label: "Mon" },
  { api: 2, label: "Tue" },
  { api: 3, label: "Wed" },
  { api: 4, label: "Thu" },
  { api: 5, label: "Fri" },
  { api: 6, label: "Sat" },
  { api: 7, label: "Sun" },
];

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

export function EmployeeWeekSchedule({
  employeeId,
  slots,
  onChange,
  canEdit,
}: {
  employeeId: string;
  slots: ScheduleAvailability[];
  onChange: () => void;
  canEdit: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [formDay, setFormDay] = useState<number | undefined>();
  const [formStart, setFormStart] = useState<string | undefined>();
  const [formEnd, setFormEnd] = useState<string | undefined>();
  const [editingSlot, setEditingSlot] = useState<ScheduleAvailability | null>(
    null,
  );

  const slotsByDay = useMemo(() => {
    const map: Record<number, ScheduleAvailability[]> = {};
    for (const s of slots) {
      (map[s.dayOfWeek] ??= []).push(s);
    }
    return map;
  }, [slots]);

  const openAddForm = (dayApi: number, hour?: number) => {
    if (!canEdit) return;
    setEditingSlot(null);
    setFormDay(dayApi);
    if (hour !== undefined) {
      setFormStart(`${padHour(hour)}:00`);
      setFormEnd(`${padHour(hour + 1)}:00`);
    } else {
      setFormStart(undefined);
      setFormEnd(undefined);
    }
    setFormOpen(true);
  };

  const openEditForm = (slot: ScheduleAvailability) => {
    if (!canEdit) return;
    setEditingSlot(slot);
    setFormDay(undefined);
    setFormStart(undefined);
    setFormEnd(undefined);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingSlot(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly Schedule</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-225">
            {/* Day headers */}
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <div />
              <div />
              {DAYS.map((day) => (
                <div
                  key={day.api}
                  className={cn(
                    "border-l border-border p-2 text-center",
                    canEdit &&
                      "cursor-pointer transition-colors hover:bg-muted/30",
                  )}
                  onClick={() => openAddForm(day.api)}
                >
                  <div className="text-sm font-medium">{day.label}</div>
                </div>
              ))}
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
              {DAYS.map((day) => {
                const daySlots = slotsByDay[day.api] ?? [];
                return (
                  <div
                    key={day.api}
                    className="relative border-l border-border"
                  >
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className={cn(
                          "border-b border-border",
                          canEdit &&
                            "cursor-pointer transition-colors hover:bg-muted/30",
                        )}
                        style={{ height: HOUR_HEIGHT }}
                        onClick={() => openAddForm(day.api, hour)}
                      />
                    ))}
                    {daySlots.map((s) => {
                      const startDec = timeToDecimal(s.startTime);
                      const endDec = timeToDecimal(s.endTime);
                      const top = (startDec - DAY_START_HOUR) * HOUR_HEIGHT;
                      const height = (endDec - startDec) * HOUR_HEIGHT;
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "absolute inset-x-0 overflow-hidden rounded-md border bg-primary/15 border-primary/40 px-1 py-0.5",
                            canEdit && "cursor-pointer hover:bg-primary/25",
                          )}
                          style={{ top, height }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(s);
                          }}
                        >
                          <div className="truncate text-xs font-medium">
                            {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
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
        open={formOpen}
        onClose={closeForm}
        onSaved={onChange}
        employeeId={employeeId}
        initial={editingSlot}
        defaultDayOfWeek={formDay}
        defaultStartTime={formStart}
        defaultEndTime={formEnd}
      />
    </Card>
  );
}
