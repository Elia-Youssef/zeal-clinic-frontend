import type { Locator, Page } from "@playwright/test";
import type { Session } from "../support/api";
import { settle } from "../support/app";
import { expect, seedContext, test as base } from "../support/fixtures";
import type { Guards } from "../support/guards";
import { card, choose, chooseIn, detail, dialog, field, input, openPopover, pickDate, pickInCalendar, searchList, trigger } from "../support/ui";
import { visualData, type VisualData } from "./visual-data";

// The screens compared with the visual goldens, at the default desktop size, in the app's light theme
// and five of them in its dark theme. The project runs after the other scenario projects, so nothing
// changes under a screen while it is taken. Lists are searched down to the fixed data of visual-data.ts,
// and what still differs between runs is masked: the dates that data hangs on, invoice numbers, the
// version, the server address, the connection dot, and the rooms the other specs left in the calendar.

type Theme = "light" | "dark";

const test = base.extend<{ data: VisualData }>({
  data: async ({ scenario }, provide) => provide(await visualData(scenario)),
});

/** The app's own theme, kept in localStorage (src/lib/stores/ui-store.ts). */
function seedTheme(theme: Theme) {
  localStorage.setItem("ui-settings", JSON.stringify({ state: { theme, scale: 1, sidebarOpen: true }, version: 0 }));
}

type Screen = {
  page: Page;
  guards: Guards;
  data: VisualData;
  /** Opens a page signed in as the visual admin (signed out with `null`) and waits for it to settle. */
  open: (url: string, session?: Session | null) => Promise<void>;
  /**
   * Waits for the page to settle, then compares the viewport (or `target`, for a dialog: what shows
   * through its backdrop depends on where the page behind it was scrolled) with the golden; `masks`
   * are painted over.
   */
  shot: (name: string, masks?: Locator[], target?: Locator) => Promise<void>;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ANY_ISO_DATE = /\d{4}-\d{2}-\d{2}/;
const DAY_MONTH = /^\d{1,2} [A-Z][a-z]{2}$/;
const DAY_NUMBER = /^\d{1,2}$/;
const INVOICE_NUMBER = /^#\d+$/;
const PRINTED_RANGE = /^\d{2}\/\d{2}\/\d{4} — \d{2}\/\d{2}\/\d{4}$/;
/** Names the other specs give their rows ("E2E 3-007 Room"). */
const OTHER_SPECS = /^E2E \d+-\d{3} /;

/** The header parts that follow the server: the bell (its badge) and the connection dot by the avatar. */
function headerMasks(page: Page): Locator[] {
  return [
    page.locator("header button:has(svg.lucide-bell)"),
    page.getByRole("button", { name: "Staff menu" }).locator("xpath=./span[not(@data-slot)]"),
  ];
}

/** The list card of a page with one searchable list. */
function listCard(page: Page): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.locator('[data-slot="card-header"]').getByPlaceholder("Search...", { exact: true }) })
    .first();
}

function cardBody(page: Page, title: string): Locator {
  return card(page, title).locator('[data-slot="card-content"]');
}

/** The From and To date pickers of a page. */
function dateFields(page: Page): Locator[] {
  return [trigger(page, "From"), trigger(page, "To")];
}

/** A dashboard KPI tile by its title. */
function tile(page: Page, title: string): Locator {
  return page.getByText(title, { exact: true }).locator("..");
}

/** Scrolls so that `target` starts right below the sticky app header. */
async function scrollTo(target: Locator): Promise<void> {
  await target.evaluate((el) => {
    el.scrollIntoView({ block: "start" });
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.body) {
      const { overflowY } = getComputedStyle(node);
      if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) break;
      node = node.parentElement;
    }
    (node && node !== document.body ? node : (document.scrollingElement ?? document.documentElement)).scrollBy(0, -64);
  });
}

/** Item card `n` (1-based) of an invoice form. */
function line(form: Locator, n: number): Locator {
  const page = form.page();
  return form
    .locator("div")
    .filter({ has: page.getByText(`Item #${n}`, { exact: true }) })
    .filter({ has: page.locator("label", { hasText: /^Type$/ }) })
    .last();
}

/** Points the From and To pickers at the visual week: nothing else has data there. */
async function setRange(page: Page, guards: Guards, data: VisualData): Promise<void> {
  await pickDate(page, "To", data.weekEnd);
  await settle(page, guards);
  await pickDate(page, "From", data.weekStart);
  await settle(page, guards);
}

async function openDay(screen: Screen): Promise<void> {
  await screen.open(`/schedule/calendar?date=${screen.data.day}`);
  await expect(screen.page.getByRole("button", { name: "Day actions" })).toBeVisible();
}

/** The calendar's date label, its heading (not a dialog's) and the room names of the other specs. */
function calendarMasks(page: Page): Locator[] {
  return [
    page.locator('[data-slot="card-header"] [data-slot="popover-trigger"]'),
    page.locator('main[data-slot="sidebar-inset"] h2'),
    page.getByText(OTHER_SPECS),
  ];
}

/** Moves an employee's Schedule card to the visual week. */
async function showWeek(screen: Screen): Promise<Locator> {
  const schedule = card(screen.page, "Schedule");
  await schedule.locator('[data-slot="card-header"] [data-slot="popover-trigger"]').first().click();
  await pickInCalendar(openPopover(screen.page), screen.data.day);
  await settle(screen.page, screen.guards);
  return schedule;
}

/** The week label, the month's hours line and the day numbers of a Schedule card. */
function scheduleMasks(page: Page, schedule: Locator): Locator[] {
  return [
    schedule.locator('[data-slot="card-header"] [data-slot="popover-trigger"]'),
    schedule.getByText(/^[A-Z][a-z]+ \d{4}: /),
    schedule.getByText(DAY_NUMBER),
    schedule.getByText(DAY_MONTH),
    page.getByText(ISO_DATE),
  ];
}

async function newAppointment(screen: Screen): Promise<Locator> {
  const { page, data } = screen;
  await page.getByRole("button", { name: "Quick Action" }).click();
  await page.getByRole("menuitem", { name: "New Appointment" }).click();
  const form = dialog(page, "New Appointment");
  const [alma] = data.patients;
  await choose(form, "Patient", `${alma.firstName} ${alma.lastName}`, alma.firstName);
  await choose(form, "Room", data.rooms[0].name, data.rooms[0].name);
  const procedures = field(form, "Procedures");
  await chooseIn(procedures.locator('[data-slot="popover-trigger"]').last(), data.procedures[0].name, data.procedures[0].name);
  const row = procedures.locator("div").filter({ has: page.getByRole("button", { name: `Remove ${data.procedures[0].name}` }) }).last();
  await chooseIn(row.locator('[data-slot="popover-trigger"]'), `${data.nurse.firstName} ${data.nurse.lastName}`, data.nurse.firstName);
  await pickDate(form, "Date", data.day);
  await input(form, "Start Time").fill("09:00");
  await input(form, "End Time").fill("10:00");
  await input(form, "Notes").fill("Follow-up visit");
  return form;
}

const screens: Record<string, (screen: Screen) => Promise<void>> = {
  async login({ open, shot }) {
    await open("/", null);
    await shot("login");
  },

  async dashboard(screen) {
    const { page, guards, data, open, shot } = screen;
    await open("/dashboard");
    await setRange(page, guards, data);
    // The tiles and cards that don't follow the range count everything the other specs made.
    const allTimeTiles = ["Receivables", "Payables", "Gift Card Liability", "Active (180d)", "Upcoming (7d)"];
    const allTimeCards = ["Inventory", "Demographics", "Today's Appointments", "Recent Transactions"];
    await shot("dashboard", [
      ...dateFields(page),
      ...allTimeTiles.map((title) => tile(page, title)),
      ...allTimeCards.map((title) => cardBody(page, title)),
    ]);
  },

  async "calendar-day"(screen) {
    await openDay(screen);
    await shot(screen, "calendar-day", calendarMasks(screen.page));
  },

  async "calendar-day-table"(screen) {
    await openDay(screen);
    await screen.page.getByRole("button", { name: "Table", exact: true }).click();
    await shot(screen, "calendar-day-table", calendarMasks(screen.page));
  },

  async "calendar-week"(screen) {
    await openDay(screen);
    await screen.page.getByRole("button", { name: "Week", exact: true }).click();
    await shot(screen, "calendar-week", [...calendarMasks(screen.page), screen.page.getByText(DAY_MONTH)]);
  },

  async "appointment-form"(screen) {
    await openDay(screen);
    const form = await newAppointment(screen);
    await shot(screen, "appointment-form", [trigger(form, "Date"), trigger(form, "End Date")], form);
  },

  async "patients-list"({ page, open, shot }) {
    await open("/patients/list");
    await searchList(listCard(page), "Visual");
    await shot("patients-list");
  },

  async "patient-form"({ page, open, shot }) {
    await open("/patients/list");
    await listCard(page).getByRole("button", { name: "New", exact: true }).click();
    const form = dialog(page, "New Patient");
    await expect(form).toBeVisible();
    await shot("patient-form", [], form);
  },

  async "patient-detail"({ page, data, open, shot }) {
    await open(`/patients/${data.patients[0].id}`);
    await shot("patient-detail", [page.getByText(ISO_DATE), page.getByText(INVOICE_NUMBER)]);
  },

  async "patient-billing"({ page, data, open, shot }) {
    await open(`/patients/${data.patients[0].id}`);
    await scrollTo(card(page, "Invoices"));
    await shot("patient-billing", [page.getByText(ISO_DATE), page.getByText(INVOICE_NUMBER)]);
  },

  async "allergies-list"({ page, open, shot }) {
    await open("/patients/allergies");
    await searchList(listCard(page), "Visual");
    await shot("allergies-list");
  },

  async "rooms-list"({ page, open, shot }) {
    await open("/schedule/rooms");
    await searchList(listCard(page), "Visual");
    await shot("rooms-list");
  },

  async "invoice-list"({ page, open, shot }) {
    await open("/financials/invoices");
    await searchList(listCard(page), "Visual");
    await shot("invoice-list", [page.getByText(INVOICE_NUMBER), page.getByText(ISO_DATE)]);
  },

  async "invoice-detail"({ page, data, open, shot }) {
    await open(`/financials/invoices/${data.invoiceId}`);
    await shot("invoice-detail", [page.getByRole("heading", { level: 2 }), detail(page, "Date")]);
  },

  async "invoice-form"({ page, data, open, shot }) {
    await open("/financials/invoices");
    await page.getByRole("button", { name: "New", exact: true }).click();
    const form = dialog(page, "New Client Invoice");
    const [alma] = data.patients;
    await choose(form, "Patient", `${alma.firstName} ${alma.lastName}`, alma.firstName);
    const item = line(form, 1);
    await choose(item, "Product", data.products[0].name, data.products[0].name);
    await input(item, "Qty").fill("2");
    await input(form, "Notes").fill("Spring check-up");
    // The form saves a draft of itself a moment after the last keystroke; the drafts rail lists it.
    await expect(form.getByText("less than a minute ago")).toBeVisible();
    await shot("invoice-form", [], form);
  },

  async "expenses-list"({ page, open, shot }) {
    await open("/financials/expenses");
    await searchList(listCard(page), "Visual");
    await shot("expenses-list");
  },

  async "currencies-list"({ open, shot }) {
    await open("/financials/currencies");
    await shot("currencies-list");
  },

  async "products-list"({ page, open, shot }) {
    await open("/inventory/products");
    await searchList(listCard(page), "Visual");
    await shot("products-list");
  },

  async "product-detail"({ page, data, open, shot }) {
    await open(`/inventory/products/${data.products[0].id}`);
    await shot("product-detail", [page.getByText(ISO_DATE), page.getByText(INVOICE_NUMBER)]);
  },

  async "procedures-list"({ page, open, shot }) {
    await open("/services/procedures");
    await searchList(listCard(page), "Visual");
    await shot("procedures-list");
  },

  async "procedure-detail"({ page, data, open, shot }) {
    await open(`/services/procedures/${data.procedures[0].id}`);
    await shot("procedure-detail", [page.getByText(ISO_DATE)]);
  },

  async "suppliers-list"({ page, open, shot }) {
    await open("/suppliers");
    await searchList(listCard(page), "Visual");
    await shot("suppliers-list");
  },

  async "team-list"({ page, open, shot }) {
    await open("/team/employees");
    await searchList(listCard(page), "Visual");
    await shot("team-list");
  },

  async "team-member"(screen) {
    const { page, data, open } = screen;
    await open(`/team/${data.nurse.id}`);
    const schedule = await showWeek(screen);
    await scrollTo(schedule);
    await shot(screen, "team-member", scheduleMasks(page, schedule));
  },

  async "team-member-schedule-table"(screen) {
    const { page, data, open } = screen;
    await open(`/team/${data.nurse.id}`);
    const schedule = await showWeek(screen);
    await schedule.getByRole("button", { name: "Table", exact: true }).click();
    await scrollTo(schedule);
    await shot(screen, "team-member-schedule-table", scheduleMasks(page, schedule));
  },

  async "holidays-list"({ page, open, shot }) {
    await open("/team/holidays");
    await searchList(listCard(page), "Visual");
    await shot("holidays-list", [page.getByText(ANY_ISO_DATE)]);
  },

  async "reports-revenue"(screen) {
    const { page, guards, data, open } = screen;
    await open("/reports");
    await setRange(page, guards, data);
    await shot(screen, "reports-revenue", [...dateFields(page), page.getByText(PRINTED_RANGE)]);
  },

  async "reports-expenses"(screen) {
    const { page, guards, data, open } = screen;
    await open("/reports");
    await page.getByRole("button", { name: "Expenses", exact: true }).click();
    await settle(page, guards);
    await setRange(page, guards, data);
    await shot(screen, "reports-expenses", [...dateFields(page), page.getByText(PRINTED_RANGE)]);
  },

  async "settings-roles"({ open, shot }) {
    await open("/settings/roles");
    await shot("settings-roles");
  },

  async "settings-role"({ open, shot }) {
    await open("/settings/roles/nurse");
    await shot("settings-role");
  },

  async "settings-staff"({ page, open, shot }) {
    await open("/settings/staff");
    await searchList(listCard(page), "visual");
    await shot("settings-staff");
  },

  async "settings-staff-form"({ page, open, shot }) {
    await open("/settings/staff");
    await listCard(page).getByRole("button", { name: "New", exact: true }).click();
    const form = dialog(page, "New Staff");
    await expect(form).toBeVisible();
    await shot("settings-staff-form", [], form);
  },

  async "settings-about"({ page, open, shot }) {
    await open("/settings/about");
    await shot("settings-about", [page.getByText("Version:", { exact: true }).locator(".."), page.getByText(/^Installed On:/)]);
  },

  async connection({ page, open, shot }) {
    await open("/connection");
    const connect = card(page, "Connect a client");
    await shot("connection", [connect.getByRole("img"), connect.locator("code")]);
  },

  async profile(screen) {
    const { page, open } = screen;
    await open("/profile");
    const schedule = await showWeek(screen);
    await scrollTo(schedule);
    await shot(screen, "profile", scheduleMasks(page, schedule));
  },
};

/** `screen.shot` without the destructuring, for screens that keep the whole object around. */
function shot(screen: Screen, name: string, masks?: Locator[], target?: Locator): Promise<void> {
  return screen.shot(name, masks, target);
}

const DARK_SCREENS = ["login", "dashboard", "calendar-day", "patient-detail", "appointment-form"];

function defineScreen(name: string, theme: Theme): void {
  const suffix = theme === "dark" ? "-dark" : "";
  test(name, async ({ page, context, guards, runtime, data }) => {
    const origin = new URL(runtime.baseURL).origin;
    let themed = false;
    const screen: Screen = {
      page,
      guards,
      data,
      open: async (url, session = data.session) => {
        if (!themed) {
          await context.addInitScript(seedTheme, theme);
          themed = true;
        }
        if (session) await seedContext(context, origin, session);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await settle(page, guards);
      },
      shot: async (shotName, masks = [], target) => {
        await settle(page, guards);
        // Off every control, so no hover state is captured.
        await page.mouse.move(1279, 1);
        const file = `${shotName}${suffix}.png`;
        if (target) await expect(target).toHaveScreenshot(file, { mask: masks });
        else await expect(page).toHaveScreenshot(file, { mask: [...headerMasks(page), ...masks] });
      },
    };
    await screens[name](screen);
  });
}

test.describe("light theme", () => {
  test.use({ colorScheme: "light" });
  for (const name of Object.keys(screens)) defineScreen(name, "light");
});

test.describe("dark theme", () => {
  test.use({ colorScheme: "dark" });
  for (const name of DARK_SCREENS) defineScreen(name, "dark");
});
