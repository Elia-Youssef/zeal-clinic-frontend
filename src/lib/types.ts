export type Country = {
  id: string;
  name: string;
};

export type LebanonCity = {
  id: string;
  name: string;
  district: string;
  governorate: string;
};

export type Patient = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: "Male" | "Female";
  dateOfBirth: string;
  contact: string;
  email?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  weight?: number;
  height?: number;
  bloodType?: string;
  countryId?: string;
  cityId?: string;
  address?: string;
  notes?: string;
  referralId?: string;
  referralSource?: string;
  createdAt: string;
  updatedAt: string;
  country?: Country;
  city?: LebanonCity;
};

export type PatientAllergy = {
  id: string;
  allergyId: string;
  allergyName?: string;
  notes?: string;
};

export type AppointmentProcedure = {
  id: string;
  patientId: string;
  procedureId: string;
  appointmentId: string;
  assignedToId?: string;
  assignedToName?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  procedureName?: string;
};

export type PrescriptionMedicine = {
  id: string;
  medicineId: string;
  prescriptionId: string;
  instructions: string;
  createdAt?: string;
  medicineName?: string;
};

export type Prescription = {
  id: string;
  patientId: string;
  prescribedById?: string;
  startDate: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  prescribedByName?: string;
  medicines: PrescriptionMedicine[];
};

export type Medicine = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

export type PatientMedicine = {
  id: string;
  patientId: string;
  medicineId: string;
  isActive?: boolean;
  notes?: string;
  createdAt: string;
  medicineName?: string;
};

export type Allergy = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

export type Room = {
  id: string;
  name: string;
  type: "Consultation" | "Procedure" | "General" | "Hospital";
  isAvailable: boolean;
  createdAt: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  patientName?: string;
  roomId: string;
  status:
    | "Scheduled"
    | "In-Progress"
    | "Completed"
    | "Cancelled"
    | "Rescheduled";
  startTime: string;
  endTime: string;
  notes: string;
  cancelNotes?: string;
  completionNotes?: string;
  rescheduledFrom?: string;
  createdAt?: string;
  updatedAt?: string;
  appointmentProcedures?: AppointmentProcedure[];
};

export type RoomDayCount = {
  roomId: string;
  roomName: string;
  days: Record<string, number>;
};

export type Salary = {
  id: string;
  employeeId: string;
  amount: number;
  currencyId: string;
  isActive: boolean;
  effectiveDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Employee = {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  role: string;
  contact: string;
  email?: string;
  dateOfBirth?: string;
  employmentType: "Full-time" | "Part-time";
  createdAt: string;
  updatedAt: string;
  user?: EmployeeUser;
};

export type EmployeeSchedule = {
  id: string;
  employeeId: string;
  /** 0 = Sunday, 6 = Saturday. */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  employeeName?: string;
};

export type EmployeeScheduleOffReason =
  | ""
  | "holiday"
  | "timeoff"
  | "no-schedule";

export type EmployeeScheduleShiftKind = "regular" | "overtime";

export type EmployeeScheduleShift = {
  startTime: string;
  endTime: string;
  kind: EmployeeScheduleShiftKind;
};

/** Projected schedule day after holidays and schedule changes are applied. */
export type EmployeeScheduleDay = {
  employeeId: string;
  employeeName?: string;
  workDate: string;
  /** 0 = Sunday, 6 = Saturday. */
  dayOfWeek: number;
  shifts: EmployeeScheduleShift[];
  isOff: boolean;
  offReason: EmployeeScheduleOffReason;
  /** Total hours including overtime. */
  hours: number;
  overtimeHours: number;
};

export type EmployeeScheduleChangeType = "timeoff" | "overtime";
export type EmployeeScheduleChangeStatus = "pending" | "accepted" | "rejected";

export type EmployeeScheduleChange = {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: EmployeeScheduleChangeType;
  startDate: string;
  endDate: string;
  /** Empty for full-day timeoff; required for overtime. */
  startTime: string;
  endTime: string;
  status: EmployeeScheduleChangeStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type EmployeeMonthHours = {
  employeeId: string;
  employeeName?: string;
  hours: number;
  overtimeHours: number;
};

export type EmployeeScheduleResponse = {
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
  days: EmployeeScheduleDay[];
  templates: EmployeeSchedule[];
  scheduleChanges: EmployeeScheduleChange[];
  holidays: Holiday[];
  monthHours: EmployeeMonthHours[];
};

export type Holiday = {
  id: string;
  name: string;
  /** Inclusive range. */
  startDate: string;
  endDate: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SalaryPreparation = {
  id: string;
  employeeId: string;
  employeeName?: string;
  periodStart: string;
  periodEnd: string;
  salaryId: string;
  transactionId: string;
  currencyId: string;
  baseSalary: number;
  adjustment: number;
  preparedAmount: number;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
};

export type ProcedureType = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

export type ProcedureCategory = {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: ProcedureCategory;
  createdAt: string;
};

export type Procedure = {
  id: string;
  name: string;
  typeId?: string;
  categoryId?: string;
  type?: ProcedureType;
  category?: ProcedureCategory;
  price: number;
  priceNote?: string;
  isActive: boolean;
  remarks?: string;
  includes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProcedurePrice = {
  id: string;
  procedureId: string;
  price: number;
  isActive: boolean;
  createdAt: string;
};

export type ProductCategory = {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: ProductCategory;
};

export type Product = {
  id: string;
  name: string;
  categoryId?: string;
  quantity: number;
  minThreshold?: number;
  unitPrice: number;
  createdAt: string;
  category?: ProductCategory;
};

export type ProductPrice = {
  id: string;
  productId: string;
  price: number;
  isActive: boolean;
  createdAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
};

export type Balance = {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  currencyId: string;
  amount?: number;
  totalIn?: number;
  totalOut?: number;
  createdAt?: string;
  updatedAt?: string;
  recentTransactions?: BalanceTransaction[];
};

export type BalanceTransaction = {
  id: string;
  fromBalanceId: string;
  toBalanceId: string;
  amount: number;
  currencyId: string;
  transactionType?: string;
  transactionMethod?: string;
  sourceType?: string;
  sourceId?: string;
  description: string;
  createdBy: string;
  createdAt: string;
  fromEntityName: string;
  toEntityName: string;
};

export type ClientRefundRequest = {
  patientId: string;
  amount: number;
  transactionMethod?: string;
  description?: string;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  itemType: "product" | "procedure" | "gift" | "other";
  itemId: string;
  quantity: number;
  amount: number;
  finalAmount: number;
  notes: string;
  createdAt: string;
  itemName?: string;
  giftPatientId?: string | null;
  giftCode?: string | null;
  giftName?: string | null;
  categoryName?: string | null;
};

export type Invoice = {
  id: string;
  invoiceNumber: number;
  fromBalanceId: string;
  toBalanceId: string;
  amount: number;
  discountId?: string;
  discountValue?: number;
  finalAmount: number;
  currencyId: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  fromEntityId: string;
  toEntityId: string;
  fromEntityName: string;
  toEntityName: string;
};

export type Transaction = {
  id: string;
  fromBalanceId: string;
  toBalanceId: string;
  amount: number;
  currencyId: string;
  exchangeRate?: number;
  transactionType?: string;
  description: string;
  createdBy: string;
  createdAt: string;
  fromEntityName: string;
  toEntityName: string;
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Role = {
  name: string;
  label: string;
  scopes: string[];
};

export type AuditLogEntry = {
  id: string;
  username: string;
  userRole: string;
  action: "POST" | "PUT" | "DELETE";
  entityType: string;
  entityId: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
};

export type Discount = {
  id: string;
  name: string;
  description?: string;
  discountType: "offer" | "gift";
  valueType: "percentage" | "fixed";
  value: number;
  patientId?: string | null;
  code?: string | null;
  redeemedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

export type BalanceAdjustment = {
  id: string;
  fromBalanceId: string;
  toBalanceId: string;
  amount: number;
  currencyId: string;
  transactionType: string;
  transactionMethod: string;
  description: string;
  createdBy: string;
  createdAt: string;
  fromEntityName: string;
  toEntityName: string;
};

export type ProcedureAllergyConflict = {
  id: string;
  allergyId: string;
  allergyName?: string;
  notes?: string;
};

export type ProductAllergyConflict = {
  id: string;
  allergyId: string;
  allergyName?: string;
  notes?: string;
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  isRead: boolean;
  createdAt: string;
};

export type UpdateStatus = {
  available: boolean;
  current: string;
  latest: string;
  releasedAt: string;
  installing: boolean;
};

export type StartUpdateResult = {
  status: "installing";
  warning?: string; // present only if the cloud-peer trigger failed
};

export type CloudRestoreResult = {
  tables: number;
  rows: number;
  localBaseline: number;
  cloudBaseline: number;
  backup: string;
  restoreId: string;
};

export type CloudRestoreProgressEvent = {
  status: "running" | "success" | "failed";
  stage: string;
  message: string;
  step: number;
  maxSteps: number;
};

export type ServerInfo = {
  url: string;
  host: string;
  port: string;
  isCloud: boolean;
};
