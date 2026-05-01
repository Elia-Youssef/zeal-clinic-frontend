/* ------------------------------------------------------------------ */
/*  Shared types: single source of truth for backend API shapes        */
/* ------------------------------------------------------------------ */

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
  referral?: { id: string; firstName: string; lastName: string };
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
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  procedureName?: string;
  patientName?: string;
  appointment?: Appointment;
};

export type PrescriptionMedicine = {
  id: string;
  medicineId: string;
  prescriptionId: string;
  instructions: string;
  status: string;
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
  status: "Scheduled" | "In-Progress" | "Completed" | "Cancelled";
  startTime: string;
  endTime: string;
  notes: string;
  cancelNotes?: string;
  completionNotes?: string;
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
  salaries: Salary[];
  user?: EmployeeUser;
};

export type ScheduleAvailability = {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveDate?: string;
  createdAt?: string;
  employeeName?: string;
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
};

export type Product = {
  id: string;
  name: string;
  categoryId?: string;
  quantity: number;
  minThreshold?: number;
  unitPrice: number;
  createdAt: string;
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
  category: string;
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
  currencyId: string;
  transactionMethod?: string;
  description?: string;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  itemType: "product" | "procedure" | "discount" | "other";
  itemId: string;
  quantity: number;
  amount: number;
  finalAmount: number;
  notes: string;
  createdAt: string;
  itemName?: string;
  discountId?: string;
  discountValue?: number;
  discountName?: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: number;
  fromBalanceId: string;
  toBalanceId: string;
  amount: number;
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
  userName: string;
  userRole: string;
  action: "POST" | "PUT" | "DELETE";
  entityType: string;
  entityId: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Discounts                                                          */
/* ------------------------------------------------------------------ */

export type DiscountItem = {
  id: string;
  discountId: string;
  itemType: "procedure" | "product";
  itemId: string;
  createdAt: string;
  itemName?: string;
};

export type Voucher = {
  id: string;
  discountId: string;
  code: string;
  isUsed: number;
  createdAt: string;
};

export type Discount = {
  id: string;
  name: string;
  description?: string;
  discountType: "offer" | "voucher" | "gift";
  valueType: "percentage" | "fixed";
  value: number;
  maxUsages?: number | null;
  currentUsages: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  items: DiscountItem[];
  vouchers: Voucher[];
};

export type InvoiceItemDiscount = {
  id: string;
  invoiceItemId: string;
  discountId: string;
  discountValue: number;
  createdAt: string;
  discountName?: string;
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
