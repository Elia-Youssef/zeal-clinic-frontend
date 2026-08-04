import { useMemo, type ReactNode } from "react";
import { CalendarClock, Clock, Plane } from "lucide-react";
import { format as fnsFormat } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/data/data-table";
import { cn, formatTimeRange } from "@/lib/utils";
import type {
  EmployeeScheduleChange,
  EmployeeScheduleChangeType,
  EmployeeScheduleDay,
  Holiday,
} from "@/lib/types";
import {
  OVERTIME_STYLE,
  REGULAR_STYLE,
  formatHours,
  offReasonLabel,
  offReasonStyle,
} from "@/components/shared/employee-schedule-utils";

/** One displayed day of the week, assembled by the parent from its week data. */
export type EmployeeScheduleRow = {
  iso: string;
  /** Short weekday label, e.g. "Mon". */
  label: string;
  date: Date;
  /** 0 = Sunday, 6 = Saturday. */
  dayOfWeek: number;
  isToday: boolean;
  projected?: EmployeeScheduleDay;
  changes: EmployeeScheduleChange[];
  holiday?: Holiday;
};

const Dash = () => <span className="text-muted-foreground">---</span>;

/**
 * Compact interactive pill. Mirrors the calendar blocks: an entry the viewer
 * may edit is a button, everything else is inert text in the same fill.
 */
function Chip({
  className,
  title,
  onClick,
  children,
}: {
  className: string;
  title?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const base = cn(
    "inline-flex max-w-full items-center gap-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-xs leading-tight",
    className,
  );
  return onClick ? (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(base, "cursor-pointer transition-opacity hover:opacity-80")}
    >
      {children}
    </button>
  ) : (
    <span title={title} className={base}>
      {children}
    </span>
  );
}

function offReasonOf(row: EmployeeScheduleRow) {
  return row.projected?.isOff ? row.projected.offReason : "";
}

function StatusCell({ row }: { row: EmployeeScheduleRow }) {
  if (!row.projected) return <Dash />;
  const offReason = offReasonOf(row);

  if (offReason) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <Badge
          variant="outline"
          className={offReasonStyle[offReason] ?? offReasonStyle["no-schedule"]}
        >
          {offReasonLabel[offReason] ?? offReason}
        </Badge>
        {offReason === "holiday" && row.holiday?.name && (
          <span
            className="text-xs text-muted-foreground"
            title={row.holiday.notes || row.holiday.name}
          >
            {row.holiday.name}
          </span>
        )}
      </div>
    );
  }

  return row.projected.shifts.length ? (
    <Badge variant="outline" className={REGULAR_STYLE}>
      Working
    </Badge>
  ) : (
    <Badge variant="outline" className={offReasonStyle["no-schedule"]}>
      Off
    </Badge>
  );
}

function ShiftsCell({
  row,
  canEditGeneral,
  canRequestChange,
  onEditDay,
  onEditChange,
}: {
  row: EmployeeScheduleRow;
  canEditGeneral: boolean;
  canRequestChange: boolean;
  onEditDay: (dayOfWeek: number, date: string) => void;
  onEditChange: (change: EmployeeScheduleChange) => void;
}) {
  const shifts = offReasonOf(row) ? [] : (row.projected?.shifts ?? []);
  if (!shifts.length) return <Dash />;

  return (
    <div className="flex flex-wrap gap-1">
      {shifts.map((shift, i) => {
        if (shift.kind === "overtime") {
          // Accepted overtime is projected as a shift; edit it through the
          // change it came from, the way the calendar block does.
          const otChange = row.changes.find(
            (c) =>
              c.type === "overtime" &&
              c.status === "accepted" &&
              c.startTime?.slice(0, 5) === shift.startTime.slice(0, 5) &&
              c.endTime?.slice(0, 5) === shift.endTime.slice(0, 5),
          );
          return (
            <Chip
              key={`shift-${i}`}
              className={OVERTIME_STYLE}
              title="Overtime"
              onClick={
                canRequestChange && otChange
                  ? () => onEditChange(otChange)
                  : undefined
              }
            >
              <span className="tabular-nums">
                {formatTimeRange(shift.startTime, shift.endTime)}
              </span>
              <span className="text-[0.625rem] opacity-75">OT</span>
            </Chip>
          );
        }

        // A weekday is edited whole, so the chip opens the day's shift set,
        // whichever segment of it was clicked.
        return (
          <Chip
            key={`shift-${i}`}
            className={REGULAR_STYLE}
            onClick={
              canEditGeneral
                ? () => onEditDay(row.dayOfWeek, row.iso)
                : undefined
            }
          >
            <span className="tabular-nums">
              {formatTimeRange(shift.startTime, shift.endTime)}
            </span>
          </Chip>
        );
      })}
    </div>
  );
}

function HoursCell({ row }: { row: EmployeeScheduleRow }) {
  const hours = row.projected?.hours ?? 0;
  const overtime = row.projected?.overtimeHours ?? 0;
  if (hours <= 0) return <Dash />;
  return (
    <span className="tabular-nums">
      {formatHours(hours)}h
      {overtime > 0 && (
        <span className="text-status-rescheduled">
          {" "}
          +{formatHours(overtime)} OT
        </span>
      )}
    </span>
  );
}

/**
 * Week schedule as one row per day: the same seven days the calendar grid
 * draws, read left to right instead of top to bottom. Every block the grid
 * makes clickable stays clickable here as a chip; whole-day actions move to
 * the row menu, since a table row has no hour to click.
 */
export function EmployeeScheduleTable({
  rows,
  canEditGeneral,
  canRequestChange,
  onEditDay,
  onRequestChange,
  onEditChange,
}: {
  rows: EmployeeScheduleRow[];
  canEditGeneral: boolean;
  canRequestChange: boolean;
  onEditDay: (dayOfWeek: number, date: string) => void;
  onRequestChange: (type: EmployeeScheduleChangeType, date: string) => void;
  onEditChange: (change: EmployeeScheduleChange) => void;
}) {
  const columns = useMemo<Column<EmployeeScheduleRow>[]>(
    () => [
      {
        key: "day",
        header: "Day",
        className: "w-28",
        render: (row) => (
          <span className="flex items-baseline gap-1.5">
            <span className={cn("font-medium", row.isToday && "text-primary")}>
              {row.label}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {fnsFormat(row.date, "d MMM")}
            </span>
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        className: "w-40 whitespace-normal",
        render: (row) => <StatusCell row={row} />,
      },
      {
        key: "shifts",
        header: "Shifts",
        className: "whitespace-normal",
        render: (row) => (
          <ShiftsCell
            row={row}
            canEditGeneral={canEditGeneral}
            canRequestChange={canRequestChange}
            onEditDay={onEditDay}
            onEditChange={onEditChange}
          />
        ),
      },
      {
        key: "hours",
        header: "Hours",
        className: "w-32",
        render: (row) => <HoursCell row={row} />,
      },
    ],
    [canEditGeneral, canRequestChange, onEditDay, onEditChange],
  );

  const actions = useMemo<RowAction<EmployeeScheduleRow>[]>(() => {
    const list: RowAction<EmployeeScheduleRow>[] = [];
    if (canEditGeneral) {
      list.push({
        label: "Edit schedule",
        icon: <CalendarClock className="size-3.5" />,
        onClick: (row) => onEditDay(row.dayOfWeek, row.iso),
      });
    }
    if (canRequestChange) {
      list.push(
        {
          label: "Request time off",
          icon: <Plane className="size-3.5" />,
          onClick: (row) => onRequestChange("timeoff", row.iso),
        },
        {
          label: "Request overtime",
          icon: <Clock className="size-3.5" />,
          onClick: (row) => onRequestChange("overtime", row.iso),
        },
      );
    }
    return list;
  }, [canEditGeneral, canRequestChange, onEditDay, onRequestChange]);

  const totals = useMemo(() => {
    let hours = 0;
    let overtime = 0;
    for (const row of rows) {
      hours += row.projected?.hours ?? 0;
      overtime += row.projected?.overtimeHours ?? 0;
    }
    return { hours, overtime };
  }, [rows]);

  return (
    <div>
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.iso}
        actions={actions}
        rowClassName={(row) => (row.isToday ? "bg-primary/5" : undefined)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Week total:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatHours(totals.hours)}h
          </span>
        </span>
        {totals.overtime > 0 && (
          <span>
            Overtime:{" "}
            <span className="font-medium text-status-rescheduled tabular-nums">
              {formatHours(totals.overtime)}h
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
