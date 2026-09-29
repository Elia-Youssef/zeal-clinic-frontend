import { apiRequest } from "../support/api";
import { expect, test } from "../support/fixtures";
import { card, choose, detail, expectToast, input, openDialog, rows, searchList, trigger } from "../support/ui";

test.use({ role: "admin" });

test("staff: create, edit with the username locked, deactivate and activate, the account's own history", async ({ page, scenario }) => {
  const username = scenario.tag();
  const displayName = scenario.name("Nurse");
  await page.goto("/settings/staff");
  const staff = card(page, "Staff");
  let form = await openDialog(page, "New Staff", staff.getByRole("button", { name: "New", exact: true }));
  await input(form, "Username").fill(username);
  await input(form, "Display Name").fill(displayName);
  await choose(form, "Role", "Nurse");
  const password = scenario.tag();
  await input(form, "Password").fill(password);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Staff member created.");
  await searchList(staff, username);
  const row = rows(staff, username);
  await expect(row).toContainText(displayName);
  await expect(row).toContainText("nurse");
  await expect(row).toContainText("Active");

  // What this account writes shows in its history, each row under the record's id.
  const session = await scenario.signIn(username, password);
  const patient = await apiRequest<{ id: string }>(scenario.baseURL, session.token, "POST", "/patients", {
    firstName: scenario.name("").trim(),
    lastName: "Patient",
    gender: "Male",
    contact: scenario.phone(),
  });
  await apiRequest(scenario.baseURL, session.token, "PUT", `/patients/${patient.id}`, { notes: "Updated by the nurse" });

  await row.click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(displayName);
  // The history names actions create / update / delete.
  const history = card(page, "Actions");
  const record = rows(history, `patients #${patient.id.slice(0, 8)}`);
  await expect(record.filter({ hasText: "create" })).toHaveCount(1);
  await expect(record.filter({ hasText: "update" })).toHaveCount(1);

  form = await openDialog(page, "Edit Staff", page.getByRole("button", { name: "Edit", exact: true }));
  await expect(input(form, "Username")).toHaveValue(username);
  await expect(input(form, "Username")).toBeDisabled();
  await input(form, "Display Name").fill(`${displayName} Two`);
  await form.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "Staff member updated.");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${displayName} Two`);

  await detail(page, "Status").getByText("Active", { exact: true }).click();
  await expectToast(page, "Staff member deactivated.");
  await expect(detail(page, "Status")).toContainText("Inactive");
  await detail(page, "Status").getByText("Inactive", { exact: true }).click();
  await expectToast(page, "Staff member activated.");
  await expect(detail(page, "Status")).toContainText("Active");
});

test("the new-staff form starts on the staff role, so an account made without picking one is a staff account", async ({ page, scenario }) => {
  const username = scenario.tag();
  await page.goto("/settings/staff");
  const staff = card(page, "Staff");
  const form = await openDialog(page, "New Staff", staff.getByRole("button", { name: "New", exact: true }));
  await expect(trigger(form, "Role")).toHaveText("Staff");
  await input(form, "Username").fill(username);
  await input(form, "Display Name").fill(scenario.name("Clerk"));
  await input(form, "Password").fill(scenario.tag());
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Staff member created.");
  await searchList(staff, username);
  await expect(rows(staff, username)).toContainText("staff");
});

test("the super-admin appears neither in the staff list nor in the audit log", async ({ page, runtime, scenario }) => {
  // Setup data is written as the super-admin all the time; the admin's own write must still show.
  const allergy = scenario.name("Allergy");
  await page.goto("/patients/allergies");
  const form = await openDialog(page, "New Allergy", card(page, "Allergies").getByRole("button", { name: "New", exact: true }));
  await input(form, "Name").fill(allergy);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Allergy created.");
  await scenario.allergy();

  await page.goto("/settings/staff");
  await searchList(card(page, "Staff"), "super-admin");
  await expect(card(page, "Staff")).toContainText("No staff match your search.");

  await page.goto("/settings/audit-log");
  const log = card(page, "Audit Log");
  await expect(rows(log, runtime.users.admin).first()).toBeVisible();
  await expect(rows(log, "super-admin")).toHaveCount(0);
  const entries = await apiRequest<{ items: { username: string; userRole: string }[] }>(
    runtime.baseURL,
    runtime.sessions.admin.token,
    "GET",
    "/audit-log?limit=100",
  );
  expect(entries.items.length).toBeGreaterThan(0);
  expect(entries.items.filter((e) => e.username === "super-admin" || e.userRole === "super-admin")).toEqual([]);
});

test("About shows the running version and that there is no newer one", async ({ page, runtime }) => {
  const health = await fetch(`${runtime.baseURL}/health`).then((r) => r.json());
  await page.goto("/settings/about");
  const about = card(page, "Zeal Clinic");
  await expect(about).toContainText("About this software");
  await expect(about).toContainText(new RegExp(`Version:\\s*${String(health.version)}`));
  await expect(about).toContainText("No new updates");
  await expect(about.getByRole("button", { name: "Force sync" })).toBeVisible();
});
