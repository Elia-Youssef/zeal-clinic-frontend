import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { capturePdf, expectPdf } from "../support/pdf";
import { addDays, clinicDay } from "../support/time";
import { choose, rows } from "../support/ui";

test.use({ role: "admin" });

const printed = (day: string) => day.split("-").reverse().join("/");
/** The report sheet: its title's header and the table under it. */
const sheet = (page: Page, title: string) =>
  page.getByRole("heading", { level: 2, name: title }).locator("xpath=../..");

test("revenue by item kind, procedure and product; the expenses report; both PDFs; print media", async ({ page, scenario }) => {
  const [patient, procedure, product, supplier] = await Promise.all([
    scenario.patient(),
    scenario.procedure({ price: 1234.5 }),
    scenario.product({ unitPrice: 20 }),
    scenario.supplier(),
  ]);
  await scenario.clientInvoice(patient.id, [
    { itemType: "procedure", itemId: procedure.id, quantity: 1, amount: 1234.5 },
    { itemType: "product", itemId: product.id, quantity: 2, amount: 40 },
  ]);
  await scenario.supplierInvoice(supplier.id, [{ productId: product.id, quantity: 5, amount: 50 }]);
  // The page opens on the last 30 days up to today.
  const from = addDays(clinicDay(), -30);
  const to = clinicDay();

  await page.goto("/reports");
  const revenue = sheet(page, "Revenue Report");
  await expect(revenue).toContainText(`${printed(from)} — ${printed(to)}`);
  await expect(revenue.getByRole("columnheader").first()).toHaveText("Item Kind");
  for (const kind of ["Procedures", "Products"]) await expect(rows(revenue, kind)).toHaveCount(1);

  await choose(page, "Group by", "Procedure");
  await expect(revenue.getByRole("columnheader").first()).toHaveText("Procedure");
  const procedureRow = rows(revenue, procedure.name);
  await expect(procedureRow).toContainText("1,234.50");

  await choose(page, "Group by", "Product");
  await expect(revenue.getByRole("columnheader").first()).toHaveText("Product");
  await expect(rows(revenue, product.name)).toContainText("40.00");
  const revenuePdf = await capturePdf(page, () => page.getByRole("button", { name: "Print", exact: true }).click());
  expectPdf(revenuePdf, ["Revenue Report", "Clinic Products — by Product", product.name, "Grand Total", "Currency: USD"]);

  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  const expenses = sheet(page, "Expenses Report");
  const bought = rows(expenses, supplier.name);
  await expect(bought).toContainText("50.00");
  await expect(bought).toContainText(product.name);
  const expensesPdf = await capturePdf(page, () => page.getByRole("button", { name: "Print", exact: true }).click());
  expectPdf(expensesPdf, ["Expenses Report", "Clinic Expenses", supplier.name]);

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Revenue", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Print", exact: true })).toBeHidden();
  await expect(expenses.getByRole("heading", { level: 2, name: "Expenses Report" })).toBeVisible();
  await expect(bought).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByRole("button", { name: "Revenue", exact: true })).toBeVisible();
});

test("a printed file opens for any signed-in role, even one that can't print it, but not without a session", async ({ page, runtime }) => {
  await page.goto("/reports");
  const [printRequest, pdf] = await Promise.all([
    page.waitForRequest((r) => new URL(r.url()).pathname === "/api/reports/revenue/pdf"),
    capturePdf(page, () => page.getByRole("button", { name: "Print", exact: true }).click()),
  ]);
  expectPdf(pdf, ["Revenue Report"]);

  const asNurse = { Authorization: `Bearer ${runtime.sessions.nurse.token}` };
  expect((await fetch(printRequest.url(), { headers: asNurse })).status).toBe(403);
  const file = await fetch(pdf.url, { headers: asNurse });
  expect(file.status).toBe(200);
  expect(file.headers.get("content-type")).toContain("application/pdf");
  expect(Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect((await fetch(pdf.url)).status).toBe(401);
});
