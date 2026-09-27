import { listItems, throwawayPassword, type Session } from "../support/api";
import type { Scenario } from "../support/scenario";
import { addDays, clinicDay, clinicTime, weekday } from "../support/time";

// Fixed, invented data for the visual goldens. Every name carries the word "Visual", so a list searched
// for it shows only these rows whatever the other specs created, and everything a screen shows reads
// the same from one run to the next. The appointments and the holiday sit in one week about seven
// months ahead: past every day the other specs touch and past any "today" mark.
//
// Building is idempotent, rows are looked up by name before they are created: Playwright starts a new
// worker after a failed test, and the new one has to find what the first one made.

type Row = { id: string; [key: string]: unknown };
type Named = Row & { name: string };
type Person = Row & { firstName: string; lastName: string };
type UserRow = Row & { username: string };

export const VISUAL_USERNAME = "visual-admin";

export type VisualWeek = {
  /** The Wednesday the appointments sit on. */
  day: string;
  /** Its Monday and Sunday. */
  weekStart: string;
  weekEnd: string;
};

export type VisualData = VisualWeek & {
  /** The account the screens are taken as: an admin with an employee record of its own. */
  session: Session;
  admin: Person;
  nurse: Person;
  rooms: Named[];
  patients: Person[];
  procedures: Named[];
  products: Named[];
  /** The client invoice of the first patient. */
  invoiceId: string;
};

/** The first Wednesday at least 200 days after `today`, with the Monday and the Sunday around it. */
export function visualWeek(today = clinicDay()): VisualWeek {
  const anchor = addDays(today, 200);
  const day = addDays(anchor, (3 - weekday(anchor) + 7) % 7);
  return { day, weekStart: addDays(day, -2), weekEnd: addDays(day, 4) };
}

function search(list: string, filter: string): string {
  return `${list}${list.includes("?") ? "&" : "?"}filter=${encodeURIComponent(filter)}&limit=100`;
}

async function findOrCreate<T extends Row>(
  scenario: Scenario,
  list: string,
  filter: string,
  matches: (row: T) => boolean,
  create: () => Promise<T>,
): Promise<T> {
  const rows = listItems(await scenario.get<{ items: T[] } | T[]>(search(list, filter)));
  return rows.find(matches) ?? (await create());
}

const byName = (name: string) => (row: Named) => row.name === name;
const byFullName = (first: string, last: string) => (row: Person) => row.firstName === first && row.lastName === last;

const PATIENTS = [
  { firstName: "Alma", gender: "Female", contact: "+1 555 0100 021", email: "alma.visual@example.com", dateOfBirth: "1988-03-14" },
  { firstName: "Bram", gender: "Male", contact: "+1 555 0100 022", email: "bram.visual@example.com", dateOfBirth: "1975-11-02" },
  { firstName: "Cleo", gender: "Female", contact: "+1 555 0100 023", email: "cleo.visual@example.com", dateOfBirth: "2001-07-21" },
];

const PROCEDURES = [
  { name: "Visual Consultation", price: 80 },
  { name: "Visual Cleaning", price: 120 },
];

const PRODUCTS = [
  { name: "Visual Gauze", unitPrice: 4, quantity: 100, minThreshold: 5 },
  { name: "Visual Gloves", unitPrice: 12, quantity: 100, minThreshold: 5 },
];

/** Patient index, room index, procedure index and clinic times of the three appointments. */
const APPOINTMENTS: [number, number, number, string, string][] = [
  [0, 0, 0, "09:00", "10:00"],
  [1, 0, 1, "10:30", "12:00"],
  [2, 1, 0, "14:00", "15:00"],
];

const SHIFT = { startTime: "09:00", endTime: "17:00" };
const HALF_DAY = { startTime: "09:00", endTime: "13:00" };

async function build(scenario: Scenario): Promise<VisualData> {
  const week = visualWeek();
  const named = (list: string, name: string, create: () => Promise<Named>) =>
    findOrCreate<Named>(scenario, list, name, byName(name), create);
  const person = (list: string, first: string, last: string, create: () => Promise<Person>) =>
    findOrCreate<Person>(scenario, list, last, byFullName(first, last), create);

  // The signed-in admin, with an employee record so the profile shows a schedule. A worker that finds
  // the account already there can't know the password the first worker chose, so it sets a new one.
  let password = throwawayPassword();
  let created = false;
  const admin = await person("/employees", "Visual", "Admin", async () => {
    created = true;
    return scenario.post<Person>("/employees", {
      firstName: "Visual",
      lastName: "Admin",
      role: "Manager",
      contact: "+1 555 0100 010",
      email: "visual.admin@example.com",
      employmentType: "Full-time",
      dateOfBirth: "1984-06-09",
      username: VISUAL_USERNAME,
      password,
      userRole: "admin",
    });
  });
  if (!created) {
    const users = listItems(await scenario.get<{ items: UserRow[] } | UserRow[]>(search("/users", VISUAL_USERNAME)));
    const account = users.find((u) => u.username === VISUAL_USERNAME);
    if (!account) throw new Error(`the ${VISUAL_USERNAME} account is missing although its employee exists`);
    password = throwawayPassword();
    await scenario.put(`/users/${account.id}`, { password });
  }
  for (const dayOfWeek of [1, 2, 3, 4, 5]) await scenario.scheduleDay(admin.id, dayOfWeek, week.weekStart, [HALF_DAY]);

  const nurse = await person("/employees", "Visual", "Nurse", () =>
    scenario.post<Person>("/employees", {
      firstName: "Visual",
      lastName: "Nurse",
      role: "Nurse",
      contact: "+1 555 0100 011",
      email: "visual.nurse@example.com",
      employmentType: "Part-time",
      dateOfBirth: "1991-02-17",
    }),
  );
  for (const dayOfWeek of [1, 3, 5]) await scenario.scheduleDay(nurse.id, dayOfWeek, week.weekStart, [SHIFT]);

  // Rooms are listed by name; these sort before the other specs' "E2E …" rooms, so the calendar shows
  // them in its first columns.
  const rooms: Named[] = [];
  for (const name of ["Amber Visual Room", "Blue Visual Room"]) {
    rooms.push(await named("/rooms", name, () => scenario.room({ name })));
  }
  const patients: Person[] = [];
  for (const fields of PATIENTS) {
    patients.push(await person("/patients", fields.firstName, "Visual", () => scenario.patient({ ...fields, lastName: "Visual" })));
  }
  const procedures: Named[] = [];
  for (const fields of PROCEDURES) {
    procedures.push(await named("/procedures", fields.name, () => scenario.procedure(fields)));
  }
  const products: Named[] = [];
  for (const fields of PRODUCTS) {
    products.push(await named("/products", fields.name, () => scenario.product(fields)));
  }

  const allergy = await named("/allergies", "Visual Pollen", () => scenario.allergy({ name: "Visual Pollen" }));
  const allergies = listItems(await scenario.get<{ items: Row[] } | Row[]>(`/patients/${patients[0].id}/allergies`));
  if (!allergies.some((a) => a.allergyId === allergy.id)) {
    await scenario.post(`/patients/${patients[0].id}/allergies`, { allergyId: allergy.id, notes: "Sneezing every spring" });
  }
  await named("/medicines", "Visual Ibuprofen", () => scenario.medicine({ name: "Visual Ibuprofen" }));
  await named("/expenses", "Visual Rent", () => scenario.expense({ name: "Visual Rent" }));
  const supplier = await named("/suppliers", "Visual Supplies", () => scenario.supplier({ name: "Visual Supplies" }));
  await named("/holidays", "Visual Holiday", () => scenario.holiday(addDays(week.day, 2), addDays(week.day, 2), { name: "Visual Holiday" }));

  // Invoices are searched by the other party's name. Stock stays well above the threshold, so no
  // low-stock notice reaches anyone.
  await findOrCreate<Row>(scenario, "/invoices?type=supplier", supplier.name, () => true, () =>
    scenario.supplierInvoice(supplier.id, [{ productId: products[0].id, quantity: 10, amount: 30 }]),
  );
  const invoice = await findOrCreate<Row>(scenario, "/invoices?type=patient", `${patients[0].firstName} Visual`, () => true, () =>
    scenario.clientInvoice(patients[0].id, [
      { itemType: "procedure", itemId: procedures[0].id, quantity: 1, amount: PROCEDURES[0].price },
      { itemType: "product", itemId: products[0].id, quantity: 2, amount: 2 * PRODUCTS[0].unitPrice },
    ]),
  );

  const booked = listItems(await scenario.get<{ items: { patientId: string }[] } | { patientId: string }[]>(`/appointments?date=${week.day}`));
  for (const [p, r, pr, start, end] of APPOINTMENTS) {
    if (booked.some((a) => a.patientId === patients[p].id)) continue;
    await scenario.appointment({
      patientId: patients[p].id,
      roomId: rooms[r].id,
      procedureIds: [procedures[pr].id],
      assignedToId: nurse.id,
      startTime: clinicTime(week.day, start),
      endTime: clinicTime(week.day, end),
      notes: "Booked for the visual goldens",
    });
  }

  const session = await scenario.signIn(VISUAL_USERNAME, password);
  return { ...week, session, admin, nurse, rooms, patients, procedures, products, invoiceId: invoice.id };
}

let building: Promise<VisualData> | undefined;

/** The data, built once per worker; a failed build is retried by the next test. */
export function visualData(scenario: Scenario): Promise<VisualData> {
  building ??= build(scenario).catch((error: unknown) => {
    building = undefined;
    throw error;
  });
  return building;
}
