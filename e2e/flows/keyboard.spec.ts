import type { Page } from "@playwright/test";
import { apiRequest } from "../support/api";
import { expect, test } from "../support/fixtures";
import { addDays, clinicDay, clinicTime } from "../support/time";
import { card, input, openDialog, opened, openPopover, rows, searchList, trigger } from "../support/ui";

// What the keyboard alone reaches and opens, and the browser tab's title.

test.use({ role: "admin" });

/** DD/MM/YYYY, the way the date picker shows a day. */
const shown = (day: string) => day.split("-").reverse().join("/");

/** The bell in the header (the other popover trigger there is the small-screen search). */
const bell = (page: Page) => page.locator('header [data-slot="popover-trigger"]').filter({ hasNotText: "Search" });

test("a patient row is a Tab stop, and Enter opens the record", async ({ page, scenario }) => {
  const patient = await scenario.patient();
  await page.goto("/patients/list");
  const list = card(page, "Patients");
  await searchList(list, patient.firstName);
  const row = rows(list, patient.fullName);
  await expect(row).toHaveCount(1);

  // The row comes right after the last column's sort button.
  await list.getByRole("button", { name: "Date of Birth", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(row).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/patients/${patient.id}$`));
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(patient.fullName);
});

test("a sortable column header sorts with Enter, then the other way with Space", async ({ page, scenario }) => {
  const prefix = scenario.name("Sorted");
  await Promise.all([scenario.patient({ firstName: `${prefix} A` }), scenario.patient({ firstName: `${prefix} B` })]);
  await page.goto("/patients/list");
  const list = card(page, "Patients");
  await searchList(list, prefix);
  await expect(rows(list)).toHaveCount(2);

  const header = list.getByRole("columnheader", { name: /^Name/ });
  const sortButton = header.getByRole("button", { name: "Name", exact: true });
  await sortButton.focus();
  await page.keyboard.press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(rows(list)).toHaveCount(2);
  await expect(rows(list)).toContainText([`${prefix} A`, `${prefix} B`]);

  // The list reloads into a new table, so the header's button is focused again.
  await sortButton.focus();
  await page.keyboard.press("Space");
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(rows(list)).toHaveCount(2);
  await expect(rows(list)).toContainText([`${prefix} B`, `${prefix} A`]);
});

test("the day calendar: Enter on an empty hour starts an appointment there, Enter on a card opens it", async ({ page, scenario }) => {
  const day = addDays(clinicDay(), 1);
  const [room, patient, procedure] = await Promise.all([scenario.room(), scenario.patient(), scenario.procedure()]);
  await scenario.appointment({
    patientId: patient.id,
    roomId: room.id,
    procedureIds: [procedure.id],
    startTime: clinicTime(day, "14:00"),
    endTime: clinicTime(day, "15:00"),
  });
  await page.goto(`/schedule/calendar?date=${day}`);
  await expect(page.getByRole("button", { name: "Day actions" })).toBeVisible();
  const appointmentCard = page.locator('[data-slot="hover-card-trigger"]').filter({ hasText: patient.fullName });
  await expect(appointmentCard).toContainText("2:00 PM - 3:00 PM");

  // An empty hour is a Tab stop: the 10 AM cell follows the 9 AM one.
  const hourCell = (hour: string) => page.getByRole("button", { name: `New appointment in ${room.name} at ${hour}`, exact: true });
  await hourCell("9 AM").focus();
  await page.keyboard.press("Tab");
  await expect(hourCell("10 AM")).toBeFocused();
  let form = await openDialog(page, "New Appointment", () => page.keyboard.press("Enter"));
  await expect(trigger(form, "Date")).toContainText(shown(day));
  await expect(input(form, "Start Time")).toHaveValue("10:00");
  await expect(input(form, "End Time")).toHaveValue("11:00");
  await page.keyboard.press("Escape");
  await expect(form).toBeHidden();

  // The card is reached with Tab too: it follows its room's last hour cell.
  await hourCell("7 PM").focus();
  await page.keyboard.press("Tab");
  await expect(appointmentCard).toBeFocused();
  form = await openDialog(page, "Edit Appointment", () => page.keyboard.press("Enter"));
  await expect(input(form, "Start Time")).toHaveValue("14:00");
  await expect(input(form, "End Time")).toHaveValue("15:00");
});

test("the employee schedule's hour cells are one Tab stop, with arrows between them", async ({ page, scenario }) => {
  const employee = await scenario.employee();
  await page.goto(`/team/${employee.id}`);
  const schedule = card(page, "Schedule");

  // The whole grid costs one Tab stop, right after the week controls; a cell
  // names its day in words, not as a raw date.
  await schedule.getByRole("button", { name: "Go to this week" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^Sunday \d+ [A-Z][a-z]+, 8 AM$/);

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^Monday \d+ [A-Z][a-z]+, 8 AM$/);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^Monday \d+ [A-Z][a-z]+, 9 AM$/);

  // One Tab leaves the grid (no other cell is a stop), and Shift+Tab comes
  // back to the cell last used.
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus[data-roving-row]")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^Monday \d+ [A-Z][a-z]+, 9 AM$/);

  // Enter opens the focused cell's menu, the way a click does.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Add shift" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem")).toHaveCount(0);
});

test("the browser tab is titled after the page and its tab; the sign-in page after itself", async ({ page, openPage }) => {
  await page.goto("/patients/allergies");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Patients");
  await expect(page).toHaveTitle("Allergies · Patients · Zeal Clinic");

  const signedOut = await openPage(null);
  await signedOut.goto("/");
  await expect(signedOut.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(signedOut).toHaveTitle("Sign in · Zeal Clinic");
});

test("Enter on an unread notification marks it read and leaves the focus on it", async ({ openPage, scenario }) => {
  // An account of its own, so the one test notification in its list is this test's. Every active
  // account also receives the low-stock and appointment notices that other specs cause meanwhile,
  // so the test follows its own notification rather than the bell's total or the list's order.
  const user = await scenario.user("admin");
  const session = await scenario.signIn(user.username, user.password);
  const page = await openPage(session);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  const sent = await apiRequest<{ id: string }>(scenario.baseURL, session.token, "POST", "/notifications/test");

  await bell(page).focus();
  const panel = await opened(openPopover(page), () => page.keyboard.press("Enter"));
  // The item's body is a button named by the notification, plus "Unread" while unread.
  const body = { name: /^Test notification/ };
  const row = panel.getByRole("listitem").filter({ has: page.getByRole("button", body) });
  const item = row.getByRole("button", body);
  await expect(item).toHaveAccessibleName(/unread/i);
  // Reached with the keyboard: it is the Tab stop right before its own delete button.
  await row.getByRole("button", { name: "Delete notification" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(item).toBeFocused();
  await page.keyboard.press("Enter");
  // The read item keeps its button (and so the focus); only the name loses "Unread".
  await expect(item).not.toHaveAccessibleName(/unread/i);
  await expect(item).toBeFocused();
  const stored = await apiRequest<{ items: { id: string; isRead: boolean }[] }>(scenario.baseURL, session.token, "GET", "/notifications");
  expect(stored.items.find((n) => n.id === sent.id)?.isRead).toBe(true);
  // The focus shows as a ring inside the item.
  await expect(item).toHaveCSS("box-shadow", /inset/);
});
