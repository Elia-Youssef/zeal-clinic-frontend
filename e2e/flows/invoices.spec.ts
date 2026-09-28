import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { card, cardAddButton, choose, confirm, expectToast, input, openDialog, rowAction, rows } from "../support/ui";

test.use({ role: "admin" });

/** Item card number `n` (1-based) of an invoice form. */
function line(form: Locator, n: number): Locator {
  const page = form.page();
  return form
    .locator("div")
    .filter({ has: page.getByText(`Item #${n}`, { exact: true }) })
    .filter({ has: page.locator("label", { hasText: /^Type$/ }) })
    .last();
}

const balanceLine = (page: Page) => page.locator("p").filter({ hasText: /^Balance:/ });

/** An invoice number no other test picks: a high range per worker. */
function customNumber(worker: number, step: number): number {
  return 700_000 + worker * 1_000 + step;
}

test("client invoice with product, procedure, gift card and other lines; stock check; custom number", async ({ page, guards, scenario }, testInfo) => {
  const [patient, product, procedure] = await Promise.all([
    scenario.patient(),
    scenario.product({ quantity: 3, minThreshold: 0, unitPrice: 20 }),
    scenario.procedure({ price: 80 }),
  ]);
  const number = customNumber(testInfo.workerIndex, 1);
  const code = scenario.tag().toUpperCase();
  guards.expectError("409 POST /api/client-invoices");

  await page.goto(`/patients/${patient.id}`);
  const form = await openDialog(page, "New Client Invoice", cardAddButton(card(page, "Invoices")));
  await expect(form.getByRole("checkbox", { name: "Auto" })).toBeChecked();

  let item = line(form, 1);
  await choose(item, "Product", product.name, product.name);
  await expect(item).toContainText("Unit: $20.00");
  await input(item, "Qty").fill("5");
  await expect(input(item, "Amount")).toHaveValue("100");
  await form.getByRole("button", { name: "Create Invoice", exact: true }).click();
  await expectToast(page, `Not enough stock for "${product.name}" (have 3, need 5)`);
  await input(item, "Qty").fill("2");
  await expect(input(item, "Amount")).toHaveValue("40");

  await form.getByRole("button", { name: "Add Item" }).click();
  item = line(form, 2);
  await choose(item, "Type", "Procedure");
  await choose(item, "Procedure", procedure.name, procedure.name);
  await expect(input(item, "Amount")).toHaveValue("80");

  await form.getByRole("button", { name: "Add Item" }).click();
  item = line(form, 3);
  await choose(item, "Type", "Gift Card");
  await input(item, "Gift Name").fill("Birthday gift");
  await item.getByRole("button", { name: "Code", exact: true }).click();
  await input(item, "Code").fill(code);
  await input(item, "Value").fill("30");

  await form.getByRole("button", { name: "Add Item" }).click();
  item = line(form, 4);
  await choose(item, "Type", "Other");
  await input(item, "Amount").fill("15");
  await input(item, "Notes").fill("Consumables");

  await form.getByRole("checkbox", { name: "Auto" }).click();
  await form.getByLabel(/^Invoice Number/).fill(String(number));
  await expect(form).toContainText("Total: $165.00");
  await form.getByRole("button", { name: "Create Invoice", exact: true }).click();
  await expectToast(page, "Client invoice created.");
  await expect(form).toBeHidden();

  await expect(rows(card(page, "Invoices"), `#${number}`)).toContainText("$165.00");
  await expect(balanceLine(page)).toHaveText("Balance: $165.00");
  expect((await scenario.get<{ quantity: number }>(`/products/${product.id}`)).quantity).toBe(1);

  const again = await openDialog(page, "New Client Invoice", cardAddButton(card(page, "Invoices")));
  await choose(line(again, 1), "Type", "Other");
  await input(line(again, 1), "Amount").fill("10");
  await again.getByRole("checkbox", { name: "Auto" }).click();
  await again.getByLabel(/^Invoice Number/).fill(String(number));
  await again.getByRole("button", { name: "Create Invoice", exact: true }).click();
  await expectToast(page, `Invoice number ${number} already exists`);
});

test("deleting an invoice voids it and restores the balance", async ({ page, scenario }) => {
  const patient = await scenario.patient();
  const invoice = await scenario.clientInvoice(patient.id, [{ itemType: "other", amount: 60, notes: "Visit" }]);
  await scenario.clientPayment(patient.id, 20, "Part payment");

  await page.goto(`/patients/${patient.id}`);
  await expect(balanceLine(page)).toHaveText("Balance: $40.00");
  await rows(card(page, "Invoices"), `#${invoice.invoiceNumber}`).click();
  await page.waitForURL(`**/financials/invoices/${invoice.id}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete invoice?" })).toContainText(`Delete invoice #${invoice.invoiceNumber}?`);
  await confirm(page, "Delete invoice?", "Delete");
  await expectToast(page, "Invoice deleted.");
  await page.waitForURL(`**/patients/${patient.id}`);
  await expect(balanceLine(page)).toHaveText("Balance: -$20.00");
  await expect(rows(card(page, "Invoices"), `#${invoice.invoiceNumber}`)).toHaveCount(0);
});

test("supplier invoice adds stock; an item amount can be edited; deleting is refused when stock would go negative", async ({ page, guards, scenario }) => {
  const [supplier, product, patient] = await Promise.all([
    scenario.supplier(),
    scenario.product({ quantity: 1, minThreshold: 0, unitPrice: 12 }),
    scenario.patient(),
  ]);
  guards.expectError("409 DELETE /api/supplier-invoices/:id");

  await page.goto(`/suppliers/${supplier.id}`);
  const form = await openDialog(page, "New Supplier Invoice", cardAddButton(card(page, "Invoices")));
  await choose(form, "Product", product.name, product.name);
  await input(form, "Qty").fill("10");
  await input(form, "Amount").fill("4.5");
  await expect(form).toContainText("Total: $45.00");
  await form.getByRole("button", { name: "Create Invoice", exact: true }).click();
  await expectToast(page, "Supplier invoice created.");
  expect((await scenario.get<{ quantity: number }>(`/products/${product.id}`)).quantity).toBe(11);

  const invoices = await scenario.get<{ items: { id: string; invoiceNumber: number }[] }>(`/suppliers/${supplier.id}/invoices`);
  const invoice = invoices.items[0];
  await expect(rows(card(page, "Invoices"), `#${invoice.invoiceNumber}`)).toContainText("$45.00");
  await rows(card(page, "Invoices"), `#${invoice.invoiceNumber}`).click();
  await page.waitForURL(`**/financials/invoices/${invoice.id}`);

  const items = card(page, "Items");
  const edit = await openDialog(page, "Edit Item Amount", () => rowAction(rows(items, product.name), "Edit Amount"));
  await expect(input(edit, "Amount")).toHaveValue("45");
  await input(edit, "Amount").fill("50");
  await edit.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "Item updated.");
  await expect(rows(items, product.name)).toContainText("$50.00");

  await scenario.clientInvoice(patient.id, [{ itemType: "product", itemId: product.id, quantity: 9, amount: 108 }]);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirm(page, "Delete invoice?", "Delete");
  await expectToast(page, `Deleting this invoice would make stock for "${product.name}" negative (have 2, would remove 10)`);
  expect((await scenario.get<{ quantity: number }>(`/products/${product.id}`)).quantity).toBe(2);
});
