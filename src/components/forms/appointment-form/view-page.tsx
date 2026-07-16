import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/shared/detail-field";
import { MultilineText } from "@/components/shared/multiline-text";
import { useRoomsStore } from "@/lib/stores/rooms-store";
import { usePermissions } from "@/hooks/use-permissions";
import { formatTimeRange } from "@/lib/utils";
import type { AppointmentFormData } from "./types";
import { mergeInitial } from "./utils";

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
  const { can } = usePermissions();

  useEffect(() => {
    if (rooms.length === 0) fetchRooms();
  }, [rooms.length, fetchRooms]);

  const roomLabel =
    rooms.find((r) => r.id === initialData.roomId)?.name ?? "---";
  const editorData = mergeInitial(initialData);
  const date = editorData.date || "---";
  const spansMultipleDays =
    !!editorData.endDate && editorData.endDate !== editorData.date;
  const dateDisplay = spansMultipleDays
    ? `${date} - ${editorData.endDate}`
    : date;
  const timeRange = formatTimeRange(
    editorData.startTime,
    editorData.endTime,
  );
  const showCancelReason =
    initialData.status === "Cancelled" || initialData.status === "Rescheduled";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <DetailField label="Patient">
          {initialData.patientId && can("patients:read") ? (
            <Link
              to={`/patients/${initialData.patientId}`}
              onClick={onClose}
              className="font-medium hover:underline"
            >
              {initialData.patientLabel || "View patient"}
            </Link>
          ) : (
            initialData.patientLabel || "---"
          )}
        </DetailField>
        <DetailField label="Room">{roomLabel}</DetailField>
        <DetailField className="sm:col-span-2" label="Procedures">
          <div className="flex flex-col gap-1">
            {initialData.procedures?.map((p) =>
              p.label ? (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-input bg-muted/30 px-3 py-1.5"
                >
                  <span className="text-sm font-medium">{p.label}</span>
                  {p.assignedToLabel ? (
                    <span className="text-xs text-muted-foreground">
                      {p.assignedToLabel}
                    </span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground/70">
                      Unassigned
                    </span>
                  )}
                </div>
              ) : null,
            )}
          </div>
        </DetailField>
        <DetailField label={spansMultipleDays ? "Dates" : "Date"}>
          {dateDisplay}
        </DetailField>
        <DetailField label="Time">{timeRange}</DetailField>
        <DetailField className="sm:col-span-2" label="Notes">
          <MultilineText value={initialData.notes} />
        </DetailField>
        {initialData.status === "Completed" && (
          <DetailField className="sm:col-span-2" label="Completion Notes">
            <MultilineText value={initialData.completionNotes} />
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
            <MultilineText value={initialData.cancelNotes} />
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
