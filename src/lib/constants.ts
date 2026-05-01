/* ------------------------------------------------------------------ */
/*  Static constants: single source of truth for dropdown options,     */
/*  color maps, and other reusable static data                         */
/* ------------------------------------------------------------------ */

export type DropdownOption = { value: string; label: string };

/* ----------------------- Dropdown Options ------------------------- */

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
  { value: "super-admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
];

export const transactionMethodOptions: DropdownOption[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Transfer" },
  { value: "discount", label: "Discount" },
  { value: "other", label: "Other" },
];

export const employeePaymentTypeOptions: DropdownOption[] = [
  { value: "salary", label: "Salary" },
  { value: "bonus", label: "Bonus" },
  { value: "adjustment", label: "Adjustment" },
];

export const invoiceItemTypeOptions: DropdownOption[] = [
  { value: "product", label: "Product" },
  { value: "procedure", label: "Procedure" },
  { value: "discount", label: "Gift Card" },
  { value: "other", label: "Other" },
];

export const discountTypeOptions: DropdownOption[] = [
  { value: "offer", label: "Offer" },
  { value: "voucher", label: "Voucher" },
  { value: "gift", label: "Gift" },
];

export const discountValueTypeOptions: DropdownOption[] = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed" },
];

export const discountItemTypeOptions: DropdownOption[] = [
  { value: "procedure", label: "Procedure" },
  { value: "product", label: "Product" },
];

export const appointmentStatuses = [
  "Scheduled",
  "In-Progress",
  "Completed",
  "Cancelled",
] as const;

export const roomTypeOptions: DropdownOption[] = [
  { value: "Consultation", label: "Consultation" },
  { value: "Procedure", label: "Procedure" },
  { value: "General", label: "General" },
  { value: "Hospital", label: "Hospital" },
];

/* ------------------------- Color Maps ---------------------------- */

/**
 * Single source of truth for appointment-status visuals. Backed by tokens
 * declared in globals.css so palette tweaks happen in one place.
 *   - `card`:  faded tint + border, used for the schedule grid block.
 *   - `badge`: solid pill, used for status badges and the picker button.
 *   - `tint`:  soft tint pill with colored text, used for table cells.
 */
export type AppointmentStatusStyle = {
  card: string;
  badge: string;
  tint: string;
};

export const appointmentStatusStyles: Record<string, AppointmentStatusStyle> = {
  Scheduled: {
    card: "bg-primary/10 border-primary/30",
    badge: "bg-primary text-primary-foreground hover:bg-primary/90",
    tint: "border-primary/20 bg-primary/10 text-foreground",
  },
  "In-Progress": {
    card: "bg-status-progress/10 border-status-progress/40",
    badge:
      "bg-status-progress text-status-progress-foreground hover:bg-status-progress/90",
    tint: "border-status-progress/30 bg-status-progress/10 text-status-progress",
  },
  Completed: {
    card: "bg-status-completed/10 border-status-completed/40",
    badge:
      "bg-status-completed text-status-completed-foreground hover:bg-status-completed/90",
    tint: "border-status-completed/30 bg-status-completed/10 text-status-completed",
  },
  Cancelled: {
    card: "bg-status-cancelled/10 border-status-cancelled/40",
    badge:
      "bg-status-cancelled text-status-cancelled-foreground hover:bg-status-cancelled/90",
    tint: "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled",
  },
};

export const defaultAppointmentStatusStyle: AppointmentStatusStyle = {
  card: "bg-muted/30 border-border",
  badge: "bg-muted text-foreground hover:bg-muted/80",
  tint: "border-border bg-muted/40 text-muted-foreground",
};

/** Look up the tint style for an appointment status, accepting either
 *  ProperCase ("Scheduled") or lowercase ("scheduled"/"in-progress"). */
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

/**
 * Single source of truth for the green/red used to indicate the direction
 * of money movement (incoming vs outgoing) and positive/negative balances.
 * Backed by the `--positive` / `--negative` tokens declared in globals.css
 * so the palette stays consistent across the app.
 */
export const transactionColors = {
  inflow: "text-positive",
  outflow: "text-negative",
  neutral: "text-muted-foreground",
} as const;

/* ----------------------- Lookup Helpers --------------------------- */

const dayOfWeekLabels: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export function fmtDayOfWeek(day: number): string {
  return dayOfWeekLabels[day] ?? `Day ${day}`;
}
