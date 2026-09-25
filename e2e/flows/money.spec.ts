import { expect, test } from "../support/fixtures";
import { card, choose, rows } from "../support/ui";

test.use({ role: "admin" });

// The dashboard formats money in several places of its own; these lock what each one prints today.
test("expense detail: a sign, a dollar sign and two decimals, no thousands separator", async ({ page, scenario }) => {
  const expense = await scenario.expense();
  await scenario.expensePayment(expense.id, 1234.5, "Large bill");
  await page.goto(`/financials/expenses/${expense.id}`);
  await expect(rows(card(page, "Payments"), "Large bill")).toContainText("-$1234.50");
});

test("reports: thousands separator and two decimals, no dollar sign", async ({ page, scenario }) => {
  const [patient, procedure] = await Promise.all([scenario.patient(), scenario.procedure({ price: 98765.43 })]);
  await scenario.clientInvoice(patient.id, [{ itemType: "procedure", itemId: procedure.id, quantity: 1, amount: 98765.43 }]);
  await page.goto("/reports");
  await choose(page, "Group by", "Procedure");
  const row = rows(page, procedure.name);
  await expect(row).toContainText("98,765.43");
  await expect(row).not.toContainText("$");
});

test("patient record: the balance uses two decimals and no thousands separator", async ({ page, scenario }) => {
  const patient = await scenario.patient();
  await scenario.clientInvoice(patient.id, [{ itemType: "other", amount: 4321.1, notes: "Package" }]);
  await page.goto(`/patients/${patient.id}`);
  await expect(page.locator("p").filter({ hasText: /^Balance:/ })).toHaveText("Balance: $4321.10");
  await expect(rows(card(page, "Invoices"))).toContainText("$4321.10");
});
