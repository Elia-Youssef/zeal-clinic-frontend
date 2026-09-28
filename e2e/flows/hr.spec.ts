import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { addDays, clinicDay, formatDay, scheduleCardMonday } from "../support/time";
import {
  card,
  cardAddButton,
  choose,
  confirm,
  detail,
  expectToast,
  input,
  openDialog,
  pickDate,
  rowAction,
  rows,
  searchList,
} from "../support/ui";

test.use({ role: "admin" });

const balanceLine = (page: Page) => page.locator("p").filter({ hasText: /^Balance:/ });

type ScheduleWeek = { days: { workDate: string; shifts: { startTime: string; endTime: string }[] }[]; scheduleChanges: { status: string; notes?: string }[] };

test("an employee with a linked account; the account button opens the staff record", async ({ page, scenario }) => {
  const first = scenario.name("").trim();
  const username = scenario.tag();
  await page.goto("/team/employees");
  const list = card(page, "Employees");
  const form = await openDialog(page, "New Employee", list.getByRole("button", { name: "New", exact: true }));
  await input(form, "First Name").fill(first);
  await input(form, "Last Name").fill("Employee");
  await input(form, "Role").fill("Nurse");
  await input(form, "Contact").fill(scenario.phone());
  await input(form, "Email").fill(`${username}@example.com`);
  await form.getByRole("checkbox", { name: "Create Staff Account" }).click();
  await input(form, "Username").fill(username);
  await input(form, "Password").fill(scenario.tag());
  await choose(form, "Staff Role", "Nurse");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Employee created.");

  await searchList(list, first);
  await expect(rows(list, `${first} Employee`)).toContainText("Full-time");
  await rows(list, `${first} Employee`).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${first} Employee`);
  await expect(detail(page, "Email")).toContainText(`${username}@example.com`);
  await page.getByRole("button", { name: "User Account" }).click();
  await page.waitForURL("**/settings/staff/*");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${first} Employee`);
  await expect(detail(page, "Username")).toContainText(username);
  await expect(detail(page, "Role")).toContainText("nurse");
});

test("a weekday schedule saved from a date keeps the earlier version", async ({ page, scenario }) => {
  const employee = await scenario.employee();
  const today = clinicDay();
  // The Monday two weeks back, and one three weeks ahead.
  const pastMonday = addDays(scheduleCardMonday(today), -14);
  const laterMonday = addDays(pastMonday, 35);
  await scenario.scheduleDay(employee.id, 1, pastMonday, [{ startTime: "09:00", endTime: "17:00" }]);

  await page.goto(`/team/${employee.id}`);
  const schedule = card(page, "Schedule");
  await schedule.getByRole("button", { name: "Table", exact: true }).click();
  const form = await openDialog(page, "Monday Schedule", () => rowAction(rows(schedule, "Mon"), "Edit schedule"));
  await expect(form).toContainText(`These hours have been in place since ${formatDay(pastMonday, "d MMM yyyy")}.`);
  await expect(form.getByLabel("Shift 1 start time")).toHaveValue("09:00");
  await form.getByLabel("Shift 1 end time").fill("13:00");
  await expect(form.getByRole("radio", { name: "Apply starting on this date" })).toBeChecked();
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expectToast(page, "Schedule saved.");

  const before = await scenario.get<ScheduleWeek>(`/employees/${employee.id}/schedule?date=${pastMonday}`);
  expect(before.days.find((d) => d.workDate.startsWith(pastMonday))?.shifts).toEqual([
    expect.objectContaining({ startTime: "09:00", endTime: "17:00" }),
  ]);
  const after = await scenario.get<ScheduleWeek>(`/employees/${employee.id}/schedule?date=${laterMonday}`);
  expect(after.days.find((d) => d.workDate.startsWith(laterMonday))?.shifts).toEqual([
    expect.objectContaining({ startTime: "09:00", endTime: "13:00" }),
  ]);
});

test("staff request time off and overtime for themselves; an admin accepts one and rejects the other", async ({ page, openPage, scenario }) => {
  const employee = await scenario.employee({}, { role: "staff" });
  const staff = await openPage(await scenario.signIn(employee.username!, employee.password!));
  const offNote = scenario.name("Dentist");
  const overtimeNote = scenario.name("Inventory count");

  await staff.goto("/profile");
  await expect(staff.getByRole("heading", { level: 2 })).toHaveText(employee.fullName);
  const own = card(staff, "Schedule");
  await own.getByRole("button", { name: "Table", exact: true }).click();
  let form = await openDialog(staff, "Request Time Off", () => rowAction(rows(own, "Tue"), "Request time off"));
  await input(form, "Notes").fill(offNote);
  await form.getByRole("button", { name: "Submit Request", exact: true }).click();
  await expectToast(staff, "Time off request submitted.");

  form = await openDialog(staff, "Request Overtime", () => rowAction(rows(own, "Wed"), "Request overtime"));
  await input(form, "Start Time").fill("18:00");
  await input(form, "End Time").fill("20:00");
  await input(form, "Notes").fill(overtimeNote);
  await form.getByRole("button", { name: "Submit Request", exact: true }).click();
  await expectToast(staff, "Overtime request submitted.");

  await page.goto(`/team/${employee.id}`);
  let view = await openDialog(page, "Time Off", page.getByTitle(`pending time off — ${offNote}`));
  await expect(view).toContainText("pending");
  await view.getByRole("button", { name: "Accept", exact: true }).click();
  await expectToast(page, "Time Off accepted.");

  view = await openDialog(page, "Overtime", page.getByTitle(`pending overtime — ${overtimeNote}`));
  await view.getByRole("button", { name: "Reject", exact: true }).click();
  await expectToast(page, "Overtime rejected.");
  await expect(page.getByTitle(`rejected overtime — ${overtimeNote}`)).toBeVisible();

  const week = await scenario.get<ScheduleWeek>(`/employees/${employee.id}/schedule?date=${scheduleCardMonday(clinicDay())}`);
  const statuses = Object.fromEntries(week.scheduleChanges.map((c) => [c.notes, c.status]));
  expect(statuses).toMatchObject({ [offNote]: "accepted", [overtimeNote]: "rejected" });
});

test("holidays are added and deleted", async ({ page, scenario }) => {
  const name = scenario.name("Holiday");
  const start = addDays(clinicDay(), 170);
  const end = addDays(start, 1);
  await page.goto("/team/holidays");
  const list = card(page, "Holidays");
  const form = await openDialog(page, "Add Holiday", list.getByRole("button", { name: "New", exact: true }));
  await input(form, "Name").fill(name);
  await pickDate(form, "Start Date", start);
  await pickDate(form, "End Date", end);
  await form.getByRole("button", { name: "Add Holiday", exact: true }).click();
  await expectToast(page, "Holiday added.");
  await searchList(list, name);
  await expect(rows(list, name)).toContainText(`${start} → ${end}`);

  await rowAction(rows(list, name), "Delete");
  await expect(page.getByRole("alertdialog", { name: "Delete holiday?" })).toContainText(
    `Delete ${name}? Employees will no longer be marked off across ${start} → ${end}.`,
  );
  await confirm(page, "Delete holiday?", "Delete");
  await expectToast(page, "Holiday deleted.");
  await expect(rows(list, name)).toHaveCount(0);
});

test("salaries by effective date, salary preparation and the employee payment that settles it", async ({ page, scenario }) => {
  const employee = await scenario.employee();
  const today = clinicDay();
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);

  await page.goto(`/team/${employee.id}`);
  const salaries = card(page, "Salaries");
  let form = await openDialog(page, "Add Salary", cardAddButton(salaries));
  await input(form, "Amount").fill("1500");
  await pickDate(form, "Effective Date", lastMonthStart);
  await form.getByRole("button", { name: "Add Salary", exact: true }).click();
  await expectToast(page, "Salary added.");
  await expect(rows(salaries, "$1500.00")).toContainText(lastMonthStart);

  form = await openDialog(page, "Add Salary", cardAddButton(salaries));
  await input(form, "Amount").fill("1800");
  await pickDate(form, "Effective Date", today);
  await form.getByRole("button", { name: "Add Salary", exact: true }).click();
  await expectToast(page, "Salary added.");
  await expect(rows(salaries, "$1800.00")).toContainText("Active");
  await expect(rows(salaries, "$1500.00")).toContainText("Inactive");

  await page.goto("/team/employees");
  form = await openDialog(page, "Prepare Salaries", page.getByRole("button", { name: "Prepare Salaries" }));
  await form.getByRole("button", { name: "Prepare", exact: true }).click();
  await expectToast(page, /^Prepared salaries for \d+ employees?\.$/);
  await expect(rows(form, employee.fullName)).toContainText("1500.00");
  await form.getByRole("button", { name: "Done", exact: true }).click();

  await page.goto(`/team/${employee.id}`);
  const prepared = card(page, "Prepared Salaries");
  const row = rows(prepared, `${lastMonthStart} → ${lastMonthEnd}`);
  await expect(row).toContainText("$1500.00");
  form = await openDialog(page, "Edit Adjustment", () => rowAction(row, "Edit Adjustment"));
  await input(form, "Adjustment").fill("100");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expectToast(page, "Adjustment updated.");
  await expect(row).toContainText("+$100.00");
  await expect(row).toContainText("$1600.00");
  await expect(balanceLine(page)).toHaveText("Balance: -$1600.00");

  form = await openDialog(page, "Record Employee Payment", cardAddButton(card(page, "Payments")));
  await input(form, "Amount").fill("1600");
  await input(form, "Description").fill("Salary paid");
  await form.getByRole("button", { name: "Record Payment", exact: true }).click();
  await expectToast(page, "Employee payment recorded.");
  await expect(balanceLine(page)).toHaveText("Balance: $0.00");
});

test("My Profile shows the signed-in user's own record, with or without an employee", async ({ openPage, scenario }) => {
  const employee = await scenario.employee({}, { role: "staff" });
  const linked = await openPage(await scenario.signIn(employee.username!, employee.password!));
  await linked.goto("/dashboard");
  await linked.getByRole("button", { name: "Staff menu" }).click();
  await linked.getByRole("menuitem", { name: "My Profile" }).click();
  await linked.waitForURL("**/profile");
  await expect(linked.getByRole("heading", { level: 2 })).toHaveText(employee.fullName);
  await expect(detail(linked, "Contact")).toBeVisible();
  await expect(linked.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);

  const user = await scenario.user("staff");
  const plain = await openPage(await scenario.signIn(user.username, user.password));
  await plain.goto("/profile");
  const details = card(plain, "Details");
  await expect(detail(details, "Name")).toContainText(user.displayName);
  await expect(detail(details, "Role")).toContainText("staff");
  await expect(detail(details, "Username")).toContainText(user.username);
  await expect(detail(details, "Status")).toContainText("Active");
});
