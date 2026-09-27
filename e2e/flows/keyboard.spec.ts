import type { Page } from "@playwright/test";
import { apiRequest } from "../support/api";
import { expect, test } from "../support/fixtures";
import { addDays, clinicDay, clinicTime } from "../support/time";
import { card, dialog, input, rows, searchList, trigger } from "../support/ui";

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

  await page.getByRole("button", { name: `New appointment in ${room.name} at 10 AM`, exact: true }).focus();
  await page.keyboard.press("Enter");
  let form = dialog(page, "New Appointment");
  await expect(form).toBeVisible();
  await expect(trigger(form, "Date")).toContainText(shown(day));
  await expect(input(form, "Start Time")).toHaveValue("10:00");
  await expect(input(form, "End Time")).toHaveValue("11:00");
  await page.keyboard.press("Escape");
  await expect(form).toBeHidden();

  await appointmentCard.focus();
  await page.keyboard.press("Enter");
  form = dialog(page, "Edit Appointment");
  await expect(form).toBeVisible();
  await expect(input(form, "Start Time")).toHaveValue("14:00");
  await expect(input(form, "End Time")).toHaveValue("15:00");
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
  // An account of its own, so its bell only counts what the test sends it.
  const user = await scenario.user("admin");
  const session = await scenario.signIn(user.username, user.password);
  const page = await openPage(session);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await apiRequest(scenario.baseURL, session.token, "POST", "/notifications/test");
  await expect(bell(page)).toHaveText("1");

  await bell(page).focus();
  await page.keyboard.press("Enter");
  const panel = page.locator('[data-slot="popover-content"][data-open]');
  // The item is the focusable block around the notification's title.
  const item = panel.getByText("Test notification", { exact: true }).locator("xpath=ancestor::div[@tabindex][1]");
  await expect(item).toBeVisible();
  await item.focus();
  await page.keyboard.press("Enter");
  await expect(bell(page)).toHaveText("");
  expect(await apiRequest<number>(scenario.baseURL, session.token, "GET", "/notifications/unread-count")).toBe(0);
  await expect(item).toBeFocused();
  // The focus shows as a ring inside the item.
  await expect(item).toHaveCSS("box-shadow", /inset/);
});
