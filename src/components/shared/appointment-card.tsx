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
  transactionColors,
} from "@/lib/constants";
import { MultilineText } from "@/components/shared/multiline-text";
import type { Appointment } from "@/lib/types";
import { cn, formatTimeRange } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

type Density = "full" | "compact" | "tiny";

function densityForHeight(px: number): Density {
  if (px >= 58) return "full";
  if (px >= 32) return "compact";
  return "tiny";
}

export type AppointmentDragMode = "move" | "resize-start" | "resize-end";

/** Patient balance: positive means the patient owes the clinic. */
export function PatientBalance({ amount }: { amount: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        amount === 0
          ? transactionColors.neutral
          : amount > 0
            ? transactionColors.outflow
            : transactionColors.inflow,
      )}
    >
      {amount < 0 ? "-" : ""}${Math.abs(amount).toFixed(2)}
    </span>
  );
}

export function AppointmentCard({
  appt,
  style,
  className,
  onClick,
  onGrab,
}: {
  appt: Appointment;
  style?: CSSProperties;
  className?: string;
  onClick?: (appt: Appointment) => void;
  onGrab?: (e: React.PointerEvent, mode: AppointmentDragMode) => void;
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
              onGrab && "select-none",
              className,
            )}
            style={style}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(appt);
            }}
            onPointerDown={onGrab ? (e) => onGrab(e, "move") : undefined}
          />
        }
      >
        {onGrab && (
          <>
            <div
              className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                onGrab(e, "resize-start");
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                onGrab(e, "resize-end");
              }}
            />
          </>
        )}
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
          {typeof appt.patientBalance === "number" && (
            <>
              <span className="text-muted-foreground">Balance</span>
              <PatientBalance amount={appt.patientBalance} />
            </>
          )}
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
