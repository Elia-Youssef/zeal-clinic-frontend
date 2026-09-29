import type { AuditAction } from "@/lib/types";

export type DropdownOption = { value: string; label: string };

export const genderOptions: DropdownOption[] = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
];

export const bloodTypeOptions: DropdownOption[] = [
  { value: "A+", label: "A+" },
  { value: "A-", label: "A-" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "O+", label: "O+" },
  { value: "O-", label: "O-" },
];

export const employmentTypeOptions: DropdownOption[] = [
  { value: "Full-time", label: "Full-time" },
  { value: "Part-time", label: "Part-time" },
];

export const userRoleOptions: DropdownOption[] = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "nurse", label: "Nurse" },
];

export const transactionMethodOptions: DropdownOption[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Transfer" },
  { value: "discount", label: "Discount" },
  { value: "other", label: "Other" },
];

export const employeePaymentTypeOptions: DropdownOption[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Transfer" },
];

export const invoiceItemTypeOptions: DropdownOption[] = [
  { value: "product", label: "Product" },
  { value: "procedure", label: "Procedure" },
  { value: "gift", label: "Gift Card" },
  { value: "other", label: "Other" },
];

export const discountTypeOptions: DropdownOption[] = [
  { value: "offer", label: "Offer" },
  { value: "gift", label: "Gift" },
];

export const discountValueTypeOptions: DropdownOption[] = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed" },
];

export const appointmentStatuses = [
  "Scheduled",
  "In-Progress",
  "Completed",
  "Cancelled",
  "Rescheduled",
] as const;

export const roomTypeOptions: DropdownOption[] = [
  { value: "Consultation", label: "Consultation" },
  { value: "Procedure", label: "Procedure" },
  { value: "General", label: "General" },
  { value: "Hospital", label: "Hospital" },
];

export type AppointmentStatusStyle = {
  card: string;
  badge: string;
  tint: string;
  /** Solid left-border color for the on-grid appointment card's status rail. */
  rail: string;
};

export const appointmentStatusStyles: Record<string, AppointmentStatusStyle> = {
  Scheduled: {
    card: "bg-primary/10 border-primary/30",
    badge: "bg-primary text-primary-foreground hover:bg-primary/90",
    tint: "border-primary/20 bg-primary/10 text-foreground",
    rail: "border-l-primary",
  },
  "In-Progress": {
    card: "bg-status-progress/10 border-status-progress/40",
    badge:
      "bg-status-progress text-status-progress-foreground hover:bg-status-progress/90",
    tint: "border-status-progress/30 bg-status-progress/10 text-status-progress",
    rail: "border-l-status-progress",
  },
  Completed: {
    card: "bg-status-completed/10 border-status-completed/40",
    badge:
      "bg-status-completed text-status-completed-foreground hover:bg-status-completed/90",
    tint: "border-status-completed/30 bg-status-completed/10 text-status-completed",
    rail: "border-l-status-completed",
  },
  Cancelled: {
    card: "bg-status-cancelled/10 border-status-cancelled/40",
    badge:
      "bg-status-cancelled text-status-cancelled-foreground hover:bg-status-cancelled/90",
    tint: "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled",
    rail: "border-l-status-cancelled",
  },
  Rescheduled: {
    card: "bg-status-rescheduled/10 border-status-rescheduled/40",
    badge:
      "bg-status-rescheduled text-status-rescheduled-foreground hover:bg-status-rescheduled/90",
    tint: "border-status-rescheduled/30 bg-status-rescheduled/10 text-status-rescheduled",
    rail: "border-l-status-rescheduled",
  },
};

export const defaultAppointmentStatusStyle: AppointmentStatusStyle = {
  card: "bg-muted/30 border-border",
  badge: "bg-muted text-foreground hover:bg-muted/80",
  tint: "border-border bg-muted/40 text-muted-foreground",
  rail: "border-l-muted-foreground",
};

/** Accepts ProperCase and lowercase backend values. */
export function appointmentStatusTint(status: string | undefined | null): string {
  if (!status) return defaultAppointmentStatusStyle.tint;
  const normalized = status
    .toLowerCase()
    .replace(/(^|-)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
  return (
    appointmentStatusStyles[normalized]?.tint ??
    defaultAppointmentStatusStyle.tint
  );
}

export const transactionColors = {
  inflow: "text-positive",
  outflow: "text-negative",
  neutral: "text-muted-foreground",
} as const;

/** Audit-log action badge colors, by the action the server stores. */
export const auditActionStyles: Record<AuditAction, string> = {
  create: "bg-positive/10 text-positive border-positive/30",
  update: "bg-status-progress/15 text-status-progress border-status-progress/30",
  delete: "bg-destructive/10 text-destructive border-destructive/30",
};

/** Holiday styling shared across schedule views and detail rows. */
export const holidayTint = "bg-warning/10";
export const holidayBadgeClass = "bg-warning/15 text-warning border-warning/40";

/** Adjustment / write-off row highlight in balance transaction tables. */
export const adjustmentRowTint = "bg-warning/10";

const dayOfWeekLabels: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export function fmtDayOfWeek(day: number): string {
  return dayOfWeekLabels[day] ?? `Day ${day}`;
}

export const dayOfWeekOptions: DropdownOption[] = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

