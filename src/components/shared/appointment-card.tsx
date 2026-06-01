import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  appointmentStatusStyles,
  defaultAppointmentStatusStyle,
} from "@/lib/constants";
import { MultilineText } from "@/components/shared/multiline-text";
import type { Appointment } from "@/lib/types";
import { cn, formatTimeRange } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

// On-grid density is driven by the block's *rendered* height, not its duration,
// so it adapts to both the calendar (tall) and the denser employee schedule.
// Full detail always lives in the hover card; short blocks drop whole rows
// (never a half-clipped line).
type Density = "full" | "compact" | "tiny";

function densityForHeight(px: number): Density {
  if (px >= 58) return "full";
  if (px >= 32) return "compact";
  return "tiny";
}

// Absolutely-positioned appointment block with a hover-card of details.
// The caller positions it via `style` (top/height in its own unit). A solid
// left rail carries the status color over an opaque surface.
export function AppointmentCard({
  appt,
  style,
  className,
  onClick,
}: {
  appt: Appointment;
  style?: CSSProperties;
  className?: string;
  onClick?: (appt: Appointment) => void;
}) {
  const { can } = usePermissions();
  const statusStyle =
    appointmentStatusStyles[appt.status] ?? defaultAppointmentStatusStyle;
  const cancelled = appt.status === "Cancelled";
  const procedures = appt.appointmentProcedures ?? [];
  const procedureLine = procedures
    .map((p) => p.procedureName)
    .filter(Boolean)
    .join(", ");

  // Measure the block so tiers track the real pixel height (handles UI scale
  // and the two grids' different hour heights). Seed from a numeric style
  // height (the schedule passes px) to avoid a first-frame flash.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(
    typeof style?.height === "number" ? style.height : 0,
  );
  useEffect(() => {
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      setHeight(box ? box.blockSize : (entries[0]?.contentRect.height ?? 0));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  const density = densityForHeight(height);

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        closeDelay={200}
        render={
          <div
            ref={setNode}
            className={cn(
              "absolute w-full cursor-pointer overflow-hidden rounded-sm border border-border border-l-5 bg-muted shadow-sm transition-opacity hover:opacity-90",
              statusStyle.rail,
              cancelled && "opacity-60",
              className,
            )}
            style={style}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(appt);
            }}
          />
        }
      >
        <div className="flex h-full flex-col justify-center gap-0.5 px-1.5 py-0.5">
          <span
            className={cn(
              "truncate text-xs font-medium leading-tight text-foreground",
              cancelled && "line-through",
            )}
          >
            {appt.patientName || "---"}
          </span>
          {density !== "tiny" && (
            <span className="truncate text-[0.625rem] leading-tight text-muted-foreground tabular-nums">
              {formatTimeRange(appt.startTime, appt.endTime)}
            </span>
          )}
          {density === "full" && procedureLine && (
            <span className="truncate text-[0.625rem] leading-tight text-muted-foreground">
              {procedureLine}
            </span>
          )}
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
          <Badge className={cn("shrink-0", statusStyle.badge)}>
            {appt.status}
          </Badge>
        </div>
        <div className="flex-1 grid grid-cols-[7em_1fr] gap-y-1 text-xs">
          <span className="text-muted-foreground">Time</span>
          <span>{formatTimeRange(appt.startTime, appt.endTime)}</span>
          <span className="text-muted-foreground">
            {procedures.length > 1 ? "Procedures" : "Procedure"}
          </span>
          <div className="flex flex-col gap-0.5">
            {procedures.length ? (
              procedures.map((p) => (
                <Badge key={p.procedureId} variant="secondary">
                  {p.procedureName || "---"}
                </Badge>
              ))
            ) : (
              <span>---</span>
            )}
          </div>
          <span className="text-muted-foreground">Notes</span>
          <MultilineText
            value={appt.notes}
            className="text-xs wrap-break-word"
          />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
