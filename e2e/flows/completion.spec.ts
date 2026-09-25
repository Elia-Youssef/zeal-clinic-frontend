import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { capturePdf, expectPdf } from "../support/pdf";
import { addDays, clinicDay, clinicTime } from "../support/time";
import { card, detail, dialog, expectToast, input, rows } from "../support/ui";

test.use({ role: "admin" });

const gridCard = (page: Page, patientName: string) =>
  page.locator('[data-slot="hover-card-trigger"]').filter({ hasText: patientName });

test("completion wizard: notes, invoice, payment; then the invoice, the balance and the invoice PDF", async ({ page, scenario }) => {
  const day = addDays(clinicDay(), 1);
  const [room, patient, first, second] = await Promise.all([
    scenario.room(),
    scenario.patient(),
    scenario.procedure({ price: 150 }),
    scenario.procedure({ price: 50 }),
  ]);
  await scenario.appointment({
    patientId: patient.id,
    roomId: room.id,
    procedureIds: [first.id, second.id],
    startTime: clinicTime(day, "10:00"),
    endTime: clinicTime(day, "11:00"),
  });

  await page.goto(`/schedule/calendar?date=${day}`);
  await gridCard(page, patient.fullName).click();
  await dialog(page, "Edit Appointment").getByRole("button", { name: "Scheduled", exact: true }).click();
  await page.getByRole("menuitem", { name: "Completed" }).click();

  const wizard = dialog(page, "Complete Appointment");
  for (const step of ["Complete", "Invoice", "Payment"]) {
    await expect(wizard.getByRole("button", { name: new RegExp(step) }).first()).toBeVisible();
  }
  await input(wizard, "Completion Notes").fill("Went well");
  await wizard.getByRole("button", { name: "Complete & Continue", exact: true }).click();
  await expectToast(page, "Appointment completed.");

  await expect(wizard.getByRole("checkbox", { name: "Auto" })).toBeChecked();
  await expect(wizard).toContainText(first.name);
  await expect(wizard).toContainText(second.name);
  await expect(wizard).toContainText("Total: $200.00");
  await wizard.getByRole("button", { name: "Create Invoice & Continue", exact: true }).click();
  await expectToast(page, "Client invoice created.");

  await expect(input(wizard, "Amount")).toHaveValue("200");
  await input(wizard, "Description").fill("Paid at the desk");
  await wizard.getByRole("button", { name: "Record Payment", exact: true }).click();
  await expectToast(page, "Client payment recorded.");
  await expect(wizard).toBeHidden();

  await gridCard(page, patient.fullName).click();
  const view = dialog(page, "View Appointment");
  await expect(detail(view, "Completion Notes")).toContainText("Went well");
  await view.getByRole("button", { name: "Close", exact: true }).last().click();

  const invoices = await scenario.get<{ items: { id: string; invoiceNumber: number; finalAmount: number }[] }>(
    `/patients/${patient.id}/invoices`,
  );
  expect(invoices.items).toHaveLength(1);
  const invoice = invoices.items[0];
  expect(invoice.finalAmount).toBe(200);

  await page.goto(`/patients/${patient.id}`);
  await expect(page.locator("p").filter({ hasText: /^Balance:/ })).toHaveText("Balance: $0.00");
  const invoiceRow = rows(card(page, "Invoices"), `#${invoice.invoiceNumber}`);
  await expect(invoiceRow).toContainText("$200.00");
  await expect(rows(card(page, "Payments"), "Paid at the desk")).toContainText("+$200.00");

  await invoiceRow.click();
  await page.waitForURL(`**/financials/invoices/${invoice.id}`);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`Invoice #${invoice.invoiceNumber}`);
  await expect(detail(page, "To")).toContainText(patient.fullName);
  const items = card(page, "Items");
  await expect(rows(items, first.name)).toContainText("$150.00");
  await expect(rows(items, second.name)).toContainText("$50.00");
  await expect(page.getByText("Total", { exact: true }).locator("..")).toContainText("$200.00");

  const pdf = await capturePdf(page, () => page.getByRole("button", { name: "Print PDF" }).click());
  expectPdf(pdf, [
    patient.fullName,
    String(invoice.invoiceNumber).padStart(8, "0"),
    first.name,
    second.name,
    "Gross Total",
    "Net",
    `USD Two Hundred Only.`,
  ]);
});

test("completing without the invoice step keeps the notes and opens read-only", async ({ page, scenario }) => {
  const day = addDays(clinicDay(), 1);
  const [room, patient, procedure] = await Promise.all([scenario.room(), scenario.patient(), scenario.procedure()]);
  await scenario.appointment({
    patientId: patient.id,
    roomId: room.id,
    procedureIds: [procedure.id],
    startTime: clinicTime(day, "16:00"),
    endTime: clinicTime(day, "16:30"),
  });
  await page.goto(`/schedule/calendar?date=${day}`);
  await gridCard(page, patient.fullName).click();
  await dialog(page, "Edit Appointment").getByRole("button", { name: "Scheduled", exact: true }).click();
  await page.getByRole("menuitem", { name: "Completed" }).click();
  const wizard = dialog(page, "Complete Appointment");
  await input(wizard, "Completion Notes").fill("No charge today");
  await wizard.getByRole("button", { name: "Complete", exact: true }).click();
  await expectToast(page, "Appointment completed.");
  await expect(wizard).toBeHidden();

  await gridCard(page, patient.fullName).click();
  const view = dialog(page, "View Appointment");
  await expect(detail(view, "Completion Notes")).toContainText("No charge today");
  await expect(view.getByRole("button", { name: "Completed", exact: true })).toBeVisible();
  expect((await scenario.get<{ items: unknown[] }>(`/patients/${patient.id}/invoices`)).items).toHaveLength(0);
});
