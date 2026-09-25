import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { card, cardAddButton, choose, confirm, dialog, expectToast, field, input, menuItem, rowAction, rows } from "../support/ui";

test.use({ role: "admin" });

const balanceLine = (page: Page) => page.locator("p").filter({ hasText: /^Balance:/ });
/** "In: $a · Out: $b", next to the balance. */
const totalsLine = (page: Page) => page.locator("p").filter({ hasText: /^In:/ });

test("supplier: payment, adjustment and write-off against an invoice; balance and totals", async ({ page, scenario }) => {
  const [supplier, product] = await Promise.all([scenario.supplier(), scenario.product()]);
  await scenario.supplierInvoice(supplier.id, [{ productId: product.id, quantity: 10, amount: 100 }]);

  await page.goto(`/suppliers/${supplier.id}`);
  await expect(balanceLine(page)).toHaveText("Balance: -$100.00");
  await expect(totalsLine(page)).toHaveText(/^In: \$0\.00\s+· Out: \$0\.00$/);
  const payments = card(page, "Payments");

  await cardAddButton(payments).click();
  let form = dialog(page, "New Supplier Payment");
  await expect(field(form, "Supplier").locator('[data-slot="popover-trigger"]')).toContainText(supplier.name);
  await input(form, "Amount").fill("60");
  await choose(form, "Method", "Transfer");
  await input(form, "Description").fill("First instalment");
  await form.getByRole("button", { name: "Record Payment", exact: true }).click();
  await expectToast(page, "Supplier payment recorded.");
  await expect(rows(payments, "First instalment")).toContainText("-$60.00");
  await expect(rows(payments, "First instalment")).toContainText("transfer");
  await expect(balanceLine(page)).toHaveText("Balance: -$40.00");

  await menuItem(payments, "Payment actions", "Adjustment");
  form = dialog(page, "New Balance Adjustment");
  await input(form, "Amount").fill("10");
  await choose(form, "Direction", "Outgoing");
  await input(form, "Description").fill("Price correction");
  await form.getByRole("button", { name: "Create Adjustment", exact: true }).click();
  await expectToast(page, "Adjustment created.");
  await expect(balanceLine(page)).toHaveText("Balance: -$30.00");

  await menuItem(payments, "Payment actions", "Write-Off");
  form = dialog(page, "New Write-Off");
  await input(form, "Amount").fill("30");
  await choose(form, "Direction", "Outgoing");
  await input(form, "Description").fill("Settled");
  await form.getByRole("button", { name: "Create Write-Off", exact: true }).click();
  await expectToast(page, "Write-off created.");
  await expect(balanceLine(page)).toHaveText("Balance: $0.00");
  // Totals leave out charges and adjustments; write-offs count.
  await expect(totalsLine(page)).toHaveText(/^In: \$0\.00\s+· Out: \$90\.00$/);

  const balance = await scenario.get<{ amount: number; totalIn: number; totalOut: number }>(`/balances/supplier/${supplier.id}`);
  expect([balance.amount, balance.totalIn, balance.totalOut]).toEqual([0, 90, 0]);

  await rowAction(rows(payments, "First instalment"), "Delete");
  await confirm(page, "Delete payment?", "Delete");
  await expectToast(page, "Payment deleted.");
  await expect(balanceLine(page)).toHaveText("Balance: -$60.00");
});

test("employee: payment, adjustment and write-off; balance", async ({ page, scenario }) => {
  const employee = await scenario.employee();
  await page.goto(`/team/${employee.id}`);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(employee.fullName);
  const payments = card(page, "Payments");

  await cardAddButton(payments).click();
  let form = dialog(page, "Record Employee Payment");
  await input(form, "Amount").fill("250");
  await choose(form, "Type", "Card");
  await input(form, "Description").fill("Advance");
  await form.getByRole("button", { name: "Record Payment", exact: true }).click();
  await expectToast(page, "Employee payment recorded.");
  await expect(rows(payments, "Advance")).toContainText("payment");
  await expect(rows(payments, "Advance")).toContainText("$250.00");
  await expect(balanceLine(page)).toHaveText("Balance: $250.00");

  await menuItem(payments, "Payment actions", "Adjustment");
  form = dialog(page, "New Balance Adjustment");
  await input(form, "Amount").fill("50");
  await choose(form, "Direction", "Incoming");
  await input(form, "Description").fill("Returned part");
  await form.getByRole("button", { name: "Create Adjustment", exact: true }).click();
  await expectToast(page, "Adjustment created.");
  await expect(balanceLine(page)).toHaveText("Balance: $200.00");

  await menuItem(payments, "Payment actions", "Write-Off");
  form = dialog(page, "New Write-Off");
  await input(form, "Amount").fill("200");
  await choose(form, "Direction", "Incoming");
  await input(form, "Description").fill("Forgiven");
  await form.getByRole("button", { name: "Create Write-Off", exact: true }).click();
  await expectToast(page, "Write-off created.");
  await expect(balanceLine(page)).toHaveText("Balance: $0.00");
  await expect(rows(payments, "Forgiven")).toContainText("write-off");
});
