import type { Locator, Page } from "@playwright/test";
import { browserState, signOut } from "../support/auth";
import { expect, test } from "../support/fixtures";
import { clinicDay } from "../support/time";
import {
  alertDialog,
  card,
  cardAddButton,
  choose,
  confirm,
  dateGroup,
  detail,
  expectToast,
  field,
  input,
  menuItem,
  openDialog,
  pickDate,
  rowAction,
  rows,
  searchList,
  typeDate,
} from "../support/ui";

test.use({ role: "admin" });

/** The patient's balance line on the record ("Balance: -$85.00"). */
const balanceLine = (page: Page) => page.locator("p").filter({ hasText: /^Balance:/ });

async function openPatient(page: Page, id: string, fullName: string): Promise<void> {
  await page.goto(`/patients/${id}`);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(fullName);
}

async function openNewPatient(page: Page): Promise<Locator> {
  return openDialog(page, "New Patient", card(page, "Patients").getByRole("button", { name: "New", exact: true }));
}

test("creates a patient after confirming the minimal-info warning", async ({ page, scenario }) => {
  const firstName = scenario.name("").trim();
  await page.goto("/patients/list");
  const form = await openNewPatient(page);
  await input(form, "First Name").fill(firstName);
  await input(form, "Last Name").fill("Patient");
  await input(form, "Contact").fill(scenario.phone());

  await form.getByRole("button", { name: "Create", exact: true }).click();
  await confirm(page, "Create patient with minimal info?", "Cancel");
  await expect(form).toBeVisible();

  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expect(alertDialog(page, "Create patient with minimal info?")).toContainText(
    "Some optional fields are empty. Are you sure you want to create this patient?",
  );
  await confirm(page, "Create patient with minimal info?", "Create");
  await expectToast(page, "Patient created.");
  await expect(form).toBeHidden();

  const list = card(page, "Patients");
  await searchList(list, firstName);
  const row = rows(list, `${firstName} Patient`);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("---");
  await row.click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${firstName} Patient`);
  await expect(detail(page, "Date of Birth")).toContainText("---");
});

test("filling weight and height skips the minimal-info warning", async ({ page, scenario }) => {
  const firstName = scenario.name("").trim();
  await page.goto("/patients/list");
  const form = await openNewPatient(page);
  await input(form, "First Name").fill(firstName);
  await input(form, "Last Name").fill("Patient");
  await input(form, "Contact").fill(scenario.phone());
  await input(form, "Weight (kg)").fill("70");
  await input(form, "Height (cm)").fill("172");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Patient created.");
  await expect(alertDialog(page, "Create patient with minimal info?")).toHaveCount(0);
});

test("edits the record: date of birth, country and city, then clears the date of birth", async ({ page, scenario }) => {
  const patient = await scenario.patient();
  // The city dropdown labels read "name, district, governorate" while its search matches the name only:
  // pick a city whose name finds a single option.
  const cities = await scenario.get<{ id: string; name: string }[]>("/lebanon-cities/dropdown?limit=40");
  let city = { label: cities[0].name, name: cities[0].name.split(",")[0] };
  for (const candidate of cities) {
    const name = candidate.name.split(",")[0];
    const found = await scenario.get<{ name: string }[]>(`/lebanon-cities/dropdown?limit=7&filter=${encodeURIComponent(name)}`);
    if (found.length === 1) {
      city = { label: candidate.name, name };
      break;
    }
  }

  await openPatient(page, patient.id, patient.fullName);
  let form = await openDialog(page, "Edit Patient", page.getByRole("button", { name: "Edit", exact: true }));
  await typeDate(form, "Date of Birth", "1990-04-12");
  await choose(form, "Country", "Lebanon", "Lebanon");
  await choose(form, "City", city.label, city.name);
  await input(form, "Details").fill("Test Street 1");
  await form.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "Patient updated.");
  await expect(detail(page, "Date of Birth")).toContainText("1990-04-12");
  await expect(detail(page, "Address")).toContainText("Lebanon");
  await expect(detail(page, "Address")).toContainText(city.name);
  await expect(detail(page, "Address")).toContainText("Test Street 1");

  form = await openDialog(page, "Edit Patient", page.getByRole("button", { name: "Edit", exact: true }));
  await dateGroup(form, "Date of Birth").getByRole("button", { name: "Clear date" }).click();
  await form.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "Patient updated.");
  await expect(detail(page, "Date of Birth")).toContainText("---");
});

test("a future date of birth is refused in the form", async ({ page, scenario }) => {
  const patient = await scenario.patient();
  await openPatient(page, patient.id, patient.fullName);
  const form = await openDialog(page, "Edit Patient", page.getByRole("button", { name: "Edit", exact: true }));
  const nextYear = String(Number(clinicDay().slice(0, 4)) + 1);
  await typeDate(form, "Date of Birth", `${nextYear}-01-15`);
  const dateOfBirth = dateGroup(form, "Date of Birth");
  await expect(dateOfBirth).toHaveAttribute("aria-invalid", "true");
  const year = dateOfBirth.getByRole("textbox", { name: "Year", exact: true });
  expect(await year.evaluate((el: HTMLInputElement) => el.validationMessage)).toBe("Date cannot be in the future.");
});

test("deleting is blocked while a prescription depends on the patient", async ({ page, guards, scenario }) => {
  const patient = await scenario.patient();
  const employee = await scenario.employee();
  const medicine = await scenario.medicine();
  await scenario.prescription(patient.id, employee.id, [medicine.id], clinicDay());
  guards.expectError("409 DELETE /api/patients/:id");

  await openPatient(page, patient.id, patient.fullName);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(alertDialog(page, "Delete patient?")).toContainText(`Delete patient ${patient.firstName} ${patient.lastName}?`);
  await confirm(page, "Delete patient?", "Delete");
  await expectToast(page, "Can't delete patient while it's in use");
  await expect(page).toHaveURL(new RegExp(`/patients/${patient.id}$`));

  const prescriptions = card(page, "Prescriptions");
  await rowAction(rows(prescriptions, medicine.name), "Delete");
  await confirm(page, "Delete prescription?", "Delete");
  await expectToast(page, "Prescription deleted.");
  await expect(prescriptions).toContainText("No data yet.");

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirm(page, "Delete patient?", "Delete");
  await expectToast(page, "Patient deleted.");
  await page.waitForURL("**/patients/list");
});

test("allergies, medicines and prescriptions on the record", async ({ page, scenario }) => {
  const patient = await scenario.patient();
  const allergy = await scenario.allergy();
  const medicine = await scenario.medicine();
  const employee = await scenario.employee();
  await openPatient(page, patient.id, patient.fullName);

  const allergies = card(page, "Allergies");
  let form = await openDialog(page, "Add Allergy", cardAddButton(allergies));
  await choose(form, "Allergy", allergy.name, allergy.name);
  await input(form, "Notes").fill("Rash on contact");
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expectToast(page, "Allergy added.");
  await expect(rows(allergies, allergy.name)).toContainText("Rash on contact");

  form = await openDialog(page, "Edit Allergy", () => rowAction(rows(allergies, allergy.name), "Edit"));
  await expect(input(form, "Allergy")).toHaveValue(allergy.name);
  await input(form, "Notes").fill("Severe rash");
  await form.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "Allergy updated.");
  await expect(rows(allergies, allergy.name)).toContainText("Severe rash");

  await rowAction(rows(allergies, allergy.name), "Delete");
  await confirm(page, "Remove allergy?", "Remove");
  await expectToast(page, "Allergy removed.");
  await expect(rows(allergies, allergy.name)).toHaveCount(0);

  const medicines = card(page, "Medicines");
  form = await openDialog(page, "Add Medicine", cardAddButton(medicines));
  await choose(form, "Medicine", medicine.name, medicine.name);
  await input(form, "Notes").fill("Morning dose");
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expectToast(page, "Medicine added.");
  await expect(rows(medicines, medicine.name)).toContainText("Morning dose");

  const prescriptions = card(page, "Prescriptions");
  form = await openDialog(page, "New Prescription", cardAddButton(prescriptions));
  await choose(form, "Prescribed By", employee.fullName, employee.fullName);
  await pickDate(form, "Start Date", clinicDay());
  await choose(form, "Medicine", medicine.name, medicine.name);
  await input(form, "Instructions").fill("Twice daily");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Prescription created.");
  const row = rows(prescriptions, medicine.name);
  await expect(row).toContainText(clinicDay());
  await expect(row).toContainText(employee.fullName);
});

test("payment, refund, adjustment and write-off from the record", async ({ page, scenario }) => {
  const patient = await scenario.patient();
  await openPatient(page, patient.id, patient.fullName);
  const payments = card(page, "Payments");
  await expect(balanceLine(page)).toHaveText("Balance: $0.00");

  let form = await openDialog(page, "New Client Payment", cardAddButton(payments));
  await expect(field(form, "Patient").locator('[data-slot="popover-trigger"]')).toContainText(patient.fullName);
  await input(form, "Amount").fill("100");
  await input(form, "Description").fill("Deposit");
  await form.getByRole("button", { name: "Record Payment", exact: true }).click();
  await expectToast(page, "Client payment recorded.");
  await expect(rows(payments, "Deposit")).toContainText("+$100.00");
  await expect(balanceLine(page)).toHaveText("Balance: -$100.00");

  form = await openDialog(page, "New Client Refund", () => menuItem(payments, "Payment actions", "Refund"));
  await input(form, "Amount").fill("30");
  await input(form, "Description").fill("Partial refund");
  await form.getByRole("button", { name: "Record Refund", exact: true }).click();
  await expectToast(page, "Refund recorded.");
  await expect(rows(payments, "Partial refund")).toContainText("-$30.00");
  await expect(balanceLine(page)).toHaveText("Balance: -$70.00");

  form = await openDialog(page, "New Balance Adjustment", () => menuItem(payments, "Payment actions", "Adjustment"));
  await input(form, "Amount").fill("10");
  await input(form, "Description").fill("Rounding adjustment");
  await form.getByRole("button", { name: "Create Adjustment", exact: true }).click();
  await expectToast(page, "Adjustment created.");
  await expect(rows(payments, "Rounding adjustment")).toContainText("adjustment");

  form = await openDialog(page, "New Write-Off", () => menuItem(payments, "Payment actions", "Write-Off"));
  await input(form, "Amount").fill("5");
  await input(form, "Description").fill("Small write-off");
  await form.getByRole("button", { name: "Create Write-Off", exact: true }).click();
  await expectToast(page, "Write-off created.");
  await expect(rows(payments, "Small write-off")).toContainText("write-off");
  await expect(balanceLine(page)).toHaveText("Balance: -$85.00");

  await rowAction(rows(payments, "Deposit"), "Delete");
  await confirm(page, "Delete payment?", "Delete");
  await expectToast(page, "Payment deleted.");
  await expect(rows(payments, "Deposit")).toHaveCount(0);
  await expect(balanceLine(page)).toHaveText("Balance: $15.00");
});

test("a cancelled new-patient draft is offered when the form opens again and dropped once the patient is created", async ({ page, scenario }) => {
  const firstName = scenario.name("").trim();
  await page.goto("/patients/list");
  let form = await openNewPatient(page);
  await input(form, "Contact").fill(scenario.phone());
  await input(form, "Weight (kg)").fill("70");
  await input(form, "Height (cm)").fill("172");
  // The draft is labelled with the name, typed last, so its first save under that label holds every field.
  await input(form, "First Name").fill(firstName);
  await input(form, "Last Name").fill("Draft");
  await expect.poll(async () => (await browserState(page)).drafts ?? "").toContain(`${firstName} Draft`);
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(form).toBeHidden();

  // Same page, no reload: the form opens empty and offers the draft.
  form = await openNewPatient(page);
  await expect(input(form, "First Name")).toHaveValue("");
  await expect(input(form, "Last Name")).toHaveValue("");
  const draft = form.getByRole("button", { name: new RegExp(`^${firstName} Draft`) });
  await draft.click();
  await expect(input(form, "First Name")).toHaveValue(firstName);
  await expect(input(form, "Last Name")).toHaveValue("Draft");
  await expect(input(form, "Weight (kg)")).toHaveValue("70");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Patient created.");
  await expect(form).toBeHidden();
  await expect.poll(async () => (await browserState(page)).drafts ?? "").not.toContain(firstName);

  form = await openNewPatient(page);
  await expect(input(form, "First Name")).toHaveValue("");
  await expect(draft).toHaveCount(0);
});

test.describe("drafts", () => {
  test.use({ ownSession: true });

  test("a new-patient draft survives a reload and is cleared at sign-out", async ({ page, scenario }) => {
    const firstName = scenario.name("").trim();
    await page.goto("/patients/list");
    let form = await openNewPatient(page);
    await input(form, "First Name").fill(firstName);
    await input(form, "Last Name").fill("Draft");
    await expect.poll(async () => (await browserState(page)).drafts ?? "").toContain(`${firstName} Draft`);
    await form.getByRole("button", { name: "Cancel", exact: true }).click();

    await page.reload();
    form = await openNewPatient(page);
    await expect(input(form, "First Name")).toHaveValue("");
    await form.getByRole("button", { name: new RegExp(`^${firstName} Draft`) }).click();
    await expect(input(form, "First Name")).toHaveValue(firstName);
    await expect(input(form, "Last Name")).toHaveValue("Draft");
    await form.getByRole("button", { name: "Cancel", exact: true }).click();

    await signOut(page);
    expect((await browserState(page)).drafts ?? "").not.toContain(firstName);
  });
});
