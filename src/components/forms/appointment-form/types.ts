import {
  CalendarClock,
  CheckCircle2,
  History,
  PlayCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type AppointmentProcedureSelection = {
  id: string;
  label: string;
  assignedToId?: string;
  assignedToLabel?: string;
};

export type AppointmentFormData = {
  id?: string;
  patientId: string;
  patientLabel?: string;
  roomId: string;
  procedures: AppointmentProcedureSelection[];
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string;
  cancelNotes?: string;
  completionNotes?: string;
};

export type Page =
  | "view"
  | "main"
  | "cancel"
  | "complete"
  | "in-progress"
  | "reinstate"
  | "invoice"
  | "payment";

export type WizardStage = "complete" | "invoice" | "payment";

export const TRANSITION_STATUSES = [
  "Scheduled",
  "In-Progress",
  "Completed",
  "Cancelled",
] as const;
export type TransitionStatus = (typeof TRANSITION_STATUSES)[number];

// A Rescheduled appointment is superseded by the replacement that carries its
// `rescheduledFrom`, so returning it to Scheduled would leave two live
// appointments for one slot. Every other status may go back.
const REINSTATABLE_FROM: readonly string[] = [
  "In-Progress",
  "Completed",
  "Cancelled",
];

export function transitionsFrom(status: string): TransitionStatus[] {
  return TRANSITION_STATUSES.filter(
    (s) =>
      s !== status &&
      (s !== "Scheduled" || REINSTATABLE_FROM.includes(status)),
  );
}

export const STATUS_ICONS: Record<string, LucideIcon> = {
  Scheduled: CalendarClock,
  "In-Progress": PlayCircle,
  Completed: CheckCircle2,
  Cancelled: XCircle,
  Rescheduled: History,
};

export const emptyForm: AppointmentFormData = {
  patientId: "",
  roomId: "",
  procedures: [],
  date: "",
  endDate: "",
  startTime: "",
  endTime: "",
  status: "Scheduled",
  notes: "",
};
