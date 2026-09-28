import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { addDays, clinicDay } from "../support/time";
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
  rows,
  searchList,
} from "../support/ui";

test.use({ role: "admin" });

const balanceLine = (page: Page) => page.locator("p").filter({ hasText: /^Balance:/ });

/** The discounts list card (its title is the All / Offers / Gifts switch). */
const discountsList = (page: Page): Locator =>
  page.locator('[data-slot="card"]').filter({ has: page.getByRole("button", { name: "Gifts", exact: true }) });

async function newOffer(page: Page, name: string, valueType: "Percentage" | "Fixed", value: string, from: string, to: string) {
  await page.goto("/financials/discounts");
  const form = await openDialog(page, "New Discount", discountsList(page).getByRole("button", { name: "New", exact: true }));
  await input(form, "Name").fill(name);
  await choose(form, "Value Type", valueType);
  await input(form, "Value").fill(value);
  await pickDate(form, "Start Date", from);
  await pickDate(form, "End Date", to);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Discount created.");
}

/** Creates an invoice with one "other" line from the patient's record, with an offer applied. */
async function invoiceWithOffer(page: Page, patientId: string, amount: string, offerLabel: string, offerName: string) {
  await page.goto(`/patients/${patientId}`);
  const form = await openDialog(page, "New Client Invoice", cardAddButton(card(page, "Invoices")));
  const item = form.locator("div").filter({ has: page.getByText("Item #1", { exact: true }) }).filter({ has: page.locator("label", { hasText: /^Type$/ }) }).last();
  await choose(item, "Type", "Other");
  await input(item, "Amount").fill(amount);
  await choose(form, "Invoice Discount", offerLabel, offerName);
  return form;
}

test("percent and fixed offers over a date range, applied on invoices and listed on the offer", async ({ page, guards, scenario }) => {
  const today = clinicDay();
  const end = addDays(today, 30);
  const percent = scenario.name("Offer");
  const fixed = scenario.name("Offer");
  const patient = await scenario.patient();

  await newOffer(page, percent, "Percentage", "10", today, end);
  await searchList(discountsList(page), percent);
  const row = rows(discountsList(page), percent);
  await expect(row).toContainText("10%");
  await expect(row).toContainText(`${today} → ${end}`);
  await expect(row).toContainText("Active");
  await newOffer(page, fixed, "Fixed", "25", today, end);

  let form = await invoiceWithOffer(page, patient.id, "200", `${percent} (10%)`, percent);
  await expect(form).toContainText("Subtotal:");
  await expect(form).toContainText("-$20.00");
  await expect(form).toContainText("Total: $180.00");
  await form.getByRole("button", { name: "Create Invoice", exact: true }).click();
  await expectToast(page, "Client invoice created.");

  form = await invoiceWithOffer(page, patient.id, "100", `${fixed} ($25.00)`, fixed);
  await expect(form).toContainText("Total: $75.00");
  await form.getByRole("button", { name: "Create Invoice", exact: true }).click();
  await expectToast(page, "Client invoice created.");
  await expect(balanceLine(page)).toHaveText("Balance: $255.00");

  const invoices = await scenario.get<{ items: { invoiceNumber: number; finalAmount: number }[] }>(`/patients/${patient.id}/invoices`);
  const discounted = invoices.items.find((i) => i.finalAmount === 180)!;
  await page.goto("/financials/discounts");
  await searchList(discountsList(page), percent);
  await rows(discountsList(page), percent).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(percent);
  await expect(detail(page, "Value")).toContainText("10%");
  const linked = rows(card(page, "Invoices"), `#${discounted.invoiceNumber}`);
  await expect(linked).toContainText("$200.00");
  await expect(linked).toContainText("-$20.00");
  await expect(linked).toContainText("$180.00");

  guards.expectError("409 DELETE /api/discounts/:id");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirm(page, "Delete discount?", "Delete");
  await expectToast(page, "Can't delete discount while it's in use");
});

test("an offer created as inactive is listed as inactive", async ({ page, scenario }) => {
  const name = scenario.name("Offer");
  await page.goto("/financials/discounts");
  const form = await openDialog(page, "New Discount", discountsList(page).getByRole("button", { name: "New", exact: true }));
  await input(form, "Name").fill(name);
  await input(form, "Value").fill("5");
  await choose(form, "Status", "Inactive");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Discount created.");
  await searchList(discountsList(page), name);
  const row = rows(discountsList(page), name);
  await expect(row).toContainText("Inactive");
  await expect(row.getByText("Active", { exact: true })).not.toBeVisible();
});

test("a gift card is sold on an invoice, redeemed once and credits the recipient", async ({ page, guards, scenario }) => {
  const [buyer, recipient] = await Promise.all([scenario.patient(), scenario.patient()]);
  const code = scenario.tag().toUpperCase();
  const giftName = scenario.name("Gift");
  await scenario.clientInvoice(buyer.id, [{ itemType: "gift", amount: 50, giftName, giftCode: code }]);

  await page.goto("/financials/discounts");
  await discountsList(page).getByRole("button", { name: "Gifts", exact: true }).click();
  await searchList(discountsList(page), giftName);
  const row = rows(discountsList(page), giftName);
  await expect(row).toContainText(code);
  await expect(row).toContainText("$50.00");
  await expect(row).toContainText("Active");

  let form = await openDialog(page, "Redeem Gift Card", page.getByRole("button", { name: "Redeem Gift" }));
  await input(form, "Code").fill(code.toLowerCase());
  await expect(input(form, "Code")).toHaveValue(code);
  await choose(form, "Patient", recipient.fullName, recipient.fullName);
  await form.getByRole("button", { name: "Redeem", exact: true }).click();
  await expectToast(page, "Gift card redeemed.");
  await expect(rows(discountsList(page), giftName)).toContainText("Redeemed");

  guards.expectError("400 POST /api/gift-cards/redeem");
  form = await openDialog(page, "Redeem Gift Card", page.getByRole("button", { name: "Redeem Gift" }));
  await input(form, "Code").fill(code);
  await choose(form, "Patient", buyer.fullName, buyer.fullName);
  await form.getByRole("button", { name: "Redeem", exact: true }).click();
  await expectToast(page, "This gift card can't be redeemed");

  await page.goto(`/patients/${recipient.id}`);
  await expect(balanceLine(page)).toHaveText("Balance: -$50.00");
  await page.goto(`/patients/${buyer.id}`);
  await expect(balanceLine(page)).toHaveText("Balance: $50.00");
});
