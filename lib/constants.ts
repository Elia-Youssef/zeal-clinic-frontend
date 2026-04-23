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

export const transactionTypeOptions: DropdownOption[] = [
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

export const dashboardStatusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  "in-progress": "bg-blue-100 text-blue-800",
  scheduled: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

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
