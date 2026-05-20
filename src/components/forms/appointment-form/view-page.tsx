import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/shared/detail-field";
import { useRoomsStore } from "@/lib/stores/rooms-store";
import { formatTimeRange } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";
import type { AppointmentFormData } from "./types";

export function ViewPage({
  initialData,
  onEdit,
  onClose,
  onOpenInSchedule,
}: {
  initialData: Partial<AppointmentFormData>;
  onEdit?: () => void;
  onClose: () => void;
  onOpenInSchedule?: () => void;
}) {
  const rooms = useRoomsStore((s) => s.rooms);
  const fetchRooms = useRoomsStore((s) => s.fetch);

  useEffect(() => {
    if (rooms.length === 0) fetchRooms();
  }, [rooms.length, fetchRooms]);

  const roomLabel =
    rooms.find((r) => r.id === initialData.roomId)?.name ?? "---";
  const date =
    initialData.date ?? (beirutDayKey(initialData.startTime) || "---");
  const timeRange = formatTimeRange(initialData.startTime, initialData.endTime);
  const showCancelReason =
    initialData.status === "Cancelled" || initialData.status === "Rescheduled";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <DetailField label="Patient">
          {initialData.patientLabel || "---"}
        </DetailField>
        <DetailField label="Room">{roomLabel}</DetailField>
        <DetailField className="sm:col-span-2" label="Procedures">
          {initialData.procedures?.map((p) =>
            p.label ? (
              <Badge key={p.id} variant="secondary" className="text-xs">
                {p.label}
              </Badge>
            ) : null,
          )}
        </DetailField>
        <DetailField label="Date">{date}</DetailField>
        <DetailField label="Time">{timeRange}</DetailField>
        <DetailField className="sm:col-span-2" label="Notes">
          <p className="whitespace-pre-wrap">{initialData.notes || "---"}</p>
        </DetailField>
        {initialData.status === "Completed" && (
          <DetailField className="sm:col-span-2" label="Completion Notes">
            <p className="whitespace-pre-wrap">
              {initialData.completionNotes || "---"}
            </p>
          </DetailField>
        )}
        {showCancelReason && (
          <DetailField
            className="sm:col-span-2"
            label={
              initialData.status === "Rescheduled"
                ? "Reschedule Reason"
                : "Cancellation Reason"
            }
          >
            <p className="whitespace-pre-wrap">
              {initialData.cancelNotes || "---"}
            </p>
          </DetailField>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onOpenInSchedule && (
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            onClick={onOpenInSchedule}
          >
            Open in Schedule
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        {onEdit && (
          <Button type="button" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}
