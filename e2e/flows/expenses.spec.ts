import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { card, cardAddButton, choose, confirm, detail, dialog, expectToast, input, menuItem, rowAction, rows, searchList } from "../support/ui";

test.use({ role: "admin" });

const expensesList = (page: Page): Locator => card(page, "Expenses");

test("expense account: payments are a charge plus a payment; adjustments, write-offs and deletes", async ({ page, guards, scenario }) => {
  const name = scenario.name("Expense");
  await page.goto("/financials/expenses");
  await expensesList(page).getByRole("button", { name: "New", exact: true }).click();
  let form = dialog(page, "New Expense");
  await input(form, "Name").fill(name);
  await input(form, "Notes").fill("Monthly rent");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Expense created.");
  await searchList(expensesList(page), name);
  await expect(rows(expensesList(page), name)).toContainText("Monthly rent");
  await rows(expensesList(page), name).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(name);
  await expect(detail(page, "Notes")).toContainText("Monthly rent");
  const payments = card(page, "Payments");
  await expect(payments).toContainText("No payments recorded yet.");

  await cardAddButton(payments).click();
  form = dialog(page, "New Expense Payment");
  await input(form, "Amount").fill("300");
  await choose(form, "Method", "Transfer");
  await input(form, "Description").fill("September rent");
  await form.getByRole("button", { name: "Record Payment", exact: true }).click();
  await expectToast(page, "Expense payment recorded.");
  const paid = rows(payments, "September rent");
  await expect(paid).toContainText("transfer");
  await expect(paid).toContainText("-$300.00");
  await expect(rows(payments)).toHaveCount(1);

  const expenseId = new URL(page.url()).pathname.split("/").pop()!;
  const balance = await scenario.get<{ amount: number }>(`/balances/expense/${expenseId}`);
  expect(balance.amount).toBe(0);

  await menuItem(payments, "Payment actions", "Adjustment");
  form = dialog(page, "New Balance Adjustment");
  await input(form, "Amount").fill("5");
  await input(form, "Description").fill("Bank fee");
  await form.getByRole("button", { name: "Create Adjustment", exact: true }).click();
  await expectToast(page, "Adjustment created.");
  await expect(rows(payments, "Bank fee")).toContainText("adjustment");
  await expect(rows(payments, "Bank fee")).toContainText("-$5.00");

  await menuItem(payments, "Payment actions", "Write-Off");
  form = dialog(page, "New Write-Off");
  await input(form, "Amount").fill("2");
  await choose(form, "Direction", "Incoming");
  await input(form, "Description").fill("Rounding");
  await form.getByRole("button", { name: "Create Write-Off", exact: true }).click();
  await expectToast(page, "Write-off created.");
  await expect(rows(payments, "Rounding")).toContainText("write-off");
  await expect(rows(payments, "Rounding")).toContainText("+$2.00");

  guards.expectError("409 DELETE /api/expenses/:id");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirm(page, "Delete expense?", "Delete");
  await expectToast(page, "Can't delete expense while it's in use");

  await rowAction(rows(payments, "September rent"), "Delete");
  await confirm(page, "Delete payment?", "Delete");
  await expectToast(page, "Payment deleted.");
  await expect(rows(payments, "September rent")).toHaveCount(0);
});

test("an expense that never had a transaction can be deleted", async ({ page, scenario }) => {
  const expense = await scenario.expense();
  await page.goto(`/financials/expenses/${expense.id}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete expense?" })).toContainText(`Delete expense ${expense.name}?`);
  await confirm(page, "Delete expense?", "Delete");
  await expectToast(page, "Expense deleted.");
  await page.waitForURL("**/financials/expenses");
});
