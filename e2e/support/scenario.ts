import { apiLogin, apiRequest, throwawayPassword, type Session } from "./api";
import type { Runtime } from "./env";

// Scenario data, built through the API as the super-admin. Every spec shares one database, so names
// carry the worker and a counter: "E2E 3-007 Patient".

type Entity = { id: string; [key: string]: unknown };

let counter = 0;

export class Scenario {
  readonly baseURL: string;
  private readonly token: string;
  private readonly worker: number;

  constructor(runtime: Runtime, worker: number) {
    this.baseURL = runtime.baseURL;
    this.token = runtime.sessions["super-admin"].token;
    this.worker = worker;
  }

  /** A name no other test uses: "E2E <worker>-<n> <label>". */
  name(label: string): string {
    counter += 1;
    return `E2E ${this.worker}-${String(counter).padStart(3, "0")} ${label}`.trim();
  }

  /** A short unique tag for usernames and codes: "e2e-3-007". */
  tag(): string {
    counter += 1;
    return `e2e-${this.worker}-${String(counter).padStart(3, "0")}`;
  }

  /** A fictional phone number that passes the backend's format check. */
  phone(): string {
    counter += 1;
    return `+1 555 01${String(this.worker % 10)}${String(counter).padStart(3, "0")}`;
  }

  get<T = Entity>(endpoint: string): Promise<T> {
    return apiRequest<T>(this.baseURL, this.token, "GET", endpoint);
  }

  post<T = Entity>(endpoint: string, body?: unknown): Promise<T> {
    return apiRequest<T>(this.baseURL, this.token, "POST", endpoint, body ?? {});
  }

  put<T = Entity>(endpoint: string, body?: unknown): Promise<T> {
    return apiRequest<T>(this.baseURL, this.token, "PUT", endpoint, body ?? {});
  }

  /** A staff account with a throwaway password. */
  async user(role: "admin" | "staff" | "nurse", fields: Record<string, unknown> = {}) {
    const username = this.tag();
    const password = throwawayPassword();
    const displayName = this.name(`${role[0].toUpperCase()}${role.slice(1)}`);
    const user = await this.post<Entity & { username: string; displayName: string }>("/users", {
      username,
      displayName,
      role,
      password,
      ...fields,
    });
    return { ...user, username, password, displayName };
  }

  /** Signs an account in through the API (sign-ins are rate limited; this waits on a 429). */
  signIn(username: string, password: string): Promise<Session> {
    return apiLogin(this.baseURL, username, password);
  }

  async patient(fields: Record<string, unknown> = {}) {
    const firstName = this.name("").trim();
    const patient = await this.post<Entity & { firstName: string; lastName: string }>("/patients", {
      firstName,
      lastName: "Patient",
      gender: "Female",
      contact: this.phone(),
      ...fields,
    });
    return { ...patient, fullName: `${patient.firstName} ${patient.lastName}` };
  }

  room(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string }>("/rooms", {
      name: this.name("Room"),
      type: "Procedure",
      isAvailable: true,
      ...fields,
    });
  }

  /** An employee, optionally with a linked account (`account` holds the account's role). */
  async employee(fields: Record<string, unknown> = {}, account?: { role: "admin" | "staff" | "nurse" }) {
    const firstName = this.name("").trim();
    const credentials = account ? { username: this.tag(), password: throwawayPassword() } : null;
    const employee = await this.post<Entity & { firstName: string; lastName: string; userId?: string }>("/employees", {
      firstName,
      lastName: "Employee",
      role: "Nurse",
      contact: this.phone(),
      employmentType: "Full-time",
      ...fields,
      ...(credentials && account ? { ...credentials, userRole: account.role } : {}),
    });
    return { ...employee, fullName: `${employee.firstName} ${employee.lastName}`, ...(credentials ?? {}) };
  }

  allergy(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string }>("/allergies", { name: this.name("Allergy"), ...fields });
  }

  medicine(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string }>("/medicines", { name: this.name("Medicine"), ...fields });
  }

  prescription(patientId: string, prescribedById: string, medicineIds: string[], startDate: string) {
    return this.post("/prescriptions", {
      patientId,
      prescribedById,
      startDate,
      medicines: medicineIds.map((medicineId) => ({ medicineId })),
    });
  }

  /** A procedure without a category, so every list shows its plain name. */
  procedure(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string; price: number }>("/procedures", {
      name: this.name("Procedure"),
      price: 100,
      ...fields,
    });
  }

  /** An appointment between two instants (UTC, as clinicTime() gives them). */
  appointment(fields: {
    patientId: string;
    roomId: string;
    startTime: string;
    endTime: string;
    procedureIds: string[];
    assignedToId?: string;
    status?: string;
    notes?: string;
  }) {
    const { procedureIds, assignedToId, ...rest } = fields;
    return this.post<Entity & { startTime: string; endTime: string; status: string }>("/appointments", {
      status: "Scheduled",
      notes: "",
      ...rest,
      appointmentProcedures: procedureIds.map((procedureId) => ({ procedureId, assignedToId: assignedToId ?? "" })),
    });
  }

  holiday(startDate: string, endDate = startDate, fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string }>("/holidays", { name: this.name("Holiday"), startDate, endDate, notes: "", ...fields });
  }

  /** A product with enough stock that it raises no low-stock notice unless asked to. */
  product(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string; quantity: number; unitPrice: number }>("/products", {
      name: this.name("Product"),
      unitPrice: 20,
      quantity: 100,
      minThreshold: 5,
      ...fields,
    });
  }

  productCategory(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string }>("/product-categories", { name: this.name("Product Category"), ...fields });
  }

  procedureType(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string }>("/procedure-types", { name: this.name("Procedure Type"), ...fields });
  }

  supplier(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string }>("/suppliers", { name: this.name("Supplier"), ...fields });
  }

  /** A supplier invoice for products; `amount` is each line's total. */
  supplierInvoice(supplierId: string, items: { productId: string; quantity: number; amount: number }[], fields: Record<string, unknown> = {}) {
    return this.post<Entity & { invoiceNumber: number }>("/supplier-invoices", {
      supplierId,
      notes: "",
      items: items.map((i) => ({ itemType: "product", itemId: i.productId, quantity: i.quantity, amount: i.amount, notes: "" })),
      ...fields,
    });
  }

  /** A client invoice; items as the API takes them ({itemType, itemId?, quantity?, amount, ...}). */
  clientInvoice(patientId: string, items: Record<string, unknown>[], fields: Record<string, unknown> = {}) {
    return this.post<Entity & { invoiceNumber: number; finalAmount: number }>("/client-invoices", {
      patientId,
      notes: "",
      items,
      ...fields,
    });
  }

  clientPayment(patientId: string, amount: number, description = "") {
    return this.post<Entity>("/client-payments", { patientId, amount, transactionMethod: "cash", description });
  }

  expense(fields: Record<string, unknown> = {}) {
    return this.post<Entity & { name: string }>("/expenses", { name: this.name("Expense"), notes: "", ...fields });
  }

  expensePayment(expenseId: string, amount: number, description = "") {
    return this.post<Entity>("/expense-payments", { expenseId, amount, transactionMethod: "cash", description });
  }

  /** Replaces an employee's shifts for one weekday from `startDate` on. */
  scheduleDay(employeeId: string, dayOfWeek: number, startDate: string, shifts: { startTime: string; endTime: string }[]) {
    return this.put("/employee-schedules/day", { employeeId, dayOfWeek, startDate, shifts });
  }
}
