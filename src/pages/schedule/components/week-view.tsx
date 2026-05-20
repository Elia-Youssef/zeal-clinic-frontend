import { useMemo } from "react";
import { format as fnsFormat } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Holiday, Room, RoomDayCount } from "@/lib/types";
import { cn } from "@/lib/utils";
import { beirutNow } from "@/lib/tz";
import { getWeekDays, toDateStr } from "./sched-utils";

// Week-view Dates carry Beirut wall-clock in their local fields (built via
// beirutNow()), so format with date-fns rather than toLocaleDateString, which
// would re-project through the browser's time zone.
const shortDate = (d: Date) => fnsFormat(d, "d MMM");
const dayLabel = (d: Date) => fnsFormat(d, "EEE");

export function WeekView({
  date,
  rooms,
  weekCounts,
  holidays,
  onDayClick,
}: {
  date: Date;
  rooms: Room[];
  weekCounts: RoomDayCount[];
  holidays: Holiday[];
  onDayClick: (day: Date) => void;
}) {
  const weekDays = useMemo(() => getWeekDays(date), [date]);
  const today = toDateStr(beirutNow());
  const gridCols = `6.25rem repeat(${rooms.length}, 1fr)`;

  const countsByRoom = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const r of weekCounts) {
      map[r.roomId] = r.days;
    }
    return map;
  }, [weekCounts]);

  // Multi-day holidays appear on each covered day.
  const holidaysByDay = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    for (const h of holidays) {
      for (const day of weekDays) {
        const dayStr = toDateStr(day);
        if (dayStr >= h.startDate && dayStr <= h.endDate) {
          (map[dayStr] ??= []).push(h);
        }
      }
    }
    return map;
  }, [holidays, weekDays]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {shortDate(weekDays[0])} - {shortDate(weekDays[6])}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-225">
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: gridCols }}
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

          {weekDays.map((day) => (
            <WeekDayRow
              key={toDateStr(day)}
              day={day}
              rooms={rooms}
              countsByRoom={countsByRoom}
              dayHolidays={holidaysByDay[toDateStr(day)]}
              isToday={toDateStr(day) === today}
              gridCols={gridCols}
              onDayClick={onDayClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekDayRow({
  day,
  rooms,
  countsByRoom,
  dayHolidays,
  isToday,
  gridCols,
  onDayClick,
}: {
  day: Date;
  rooms: Room[];
  countsByRoom: Record<string, Record<string, number>>;
  dayHolidays: Holiday[] | undefined;
  isToday: boolean;
  gridCols: string;
  onDayClick: (day: Date) => void;
}) {
  const dayStr = toDateStr(day);
  const isHoliday = !!dayHolidays?.length;

  return (
    <div
      className={cn(
        "grid border-b border-border",
        isToday && "bg-primary/10",
        isHoliday && "bg-amber-500/10",
      )}
      style={{ gridTemplateColumns: gridCols }}
    >
      <div
        className={cn(
          "cursor-pointer p-3 transition-colors hover:bg-muted/50",
          isToday && "font-semibold",
        )}
        onClick={() => onDayClick(day)}
      >
        <div className="text-sm">{dayLabel(day)}</div>
        <div className="text-xs text-muted-foreground">{shortDate(day)}</div>
        {dayHolidays?.map((h) => (
          <Badge
            key={h.id}
            variant="secondary"
            className="mt-1 bg-amber-500/20 text-amber-900 dark:text-amber-200"
            title={h.notes || h.name}
          >
            {h.name}
          </Badge>
        ))}
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
}
