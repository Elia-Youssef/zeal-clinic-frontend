import { expect, test } from "../support/fixtures";
import {
  card,
  cardAddButton,
  choose,
  confirm,
  detail,
  dialog,
  expectToast,
  input,
  rowAction,
  rows,
  searchList,
} from "../support/ui";

test.use({ role: "admin" });

test("nested categories, a product with a threshold, its price history and allergy conflicts", async ({ page, scenario }) => {
  const parent = scenario.name("Category");
  const child = scenario.name("Category");
  const product = scenario.name("Product");
  const allergy = await scenario.allergy();

  await page.goto("/inventory/categories");
  const categories = card(page, "Categories");
  await categories.getByRole("button", { name: "New", exact: true }).click();
  let form = dialog(page, "New Category");
  await input(form, "Name").fill(parent);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Category created.");
  await categories.getByRole("button", { name: "New", exact: true }).click();
  form = dialog(page, "New Category");
  await input(form, "Name").fill(child);
  await choose(form, "Parent Category", parent, parent);
  await input(form, "Description").fill("Nested one level");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Category created.");
  await searchList(categories, child);
  await expect(rows(categories, child)).toContainText(parent);
  await expect(rows(categories, child)).toContainText("Nested one level");

  await page.getByRole("link", { name: "Products", exact: true }).last().click();
  const products = card(page, "Products");
  await products.getByRole("button", { name: "New", exact: true }).click();
  form = dialog(page, "New Product");
  await input(form, "Name").fill(product);
  await choose(form, "Category", child, child);
  await input(form, "Unit Price").fill("12.5");
  await input(form, "Quantity").fill("10");
  await input(form, "Min Threshold").fill("3");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Product created.");
  await searchList(products, product);
  const row = rows(products, product);
  await expect(row).toContainText(parent);
  await expect(row).toContainText(child);
  await expect(row).toContainText("10");
  await expect(row).toContainText("$12.50");

  await row.click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(product);
  await expect(detail(page, "Price")).toContainText("$12.50");
  await expect(detail(page, "Stock")).toContainText("10");
  await expect(detail(page, "Min Threshold")).toContainText("3");
  const history = card(page, "Pricing History");
  await expect(rows(history)).toHaveCount(1);
  await expect(rows(history).first()).toContainText("Current");

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  form = dialog(page, "Edit Product");
  await input(form, "Unit Price").fill("15");
  await form.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "Product updated.");
  await expect(detail(page, "Price")).toContainText("$15.00");
  await expect(rows(history)).toHaveCount(2);
  await expect(rows(history).first()).toContainText("Current");
  await expect(rows(history).first()).toContainText("$15.00");
  await expect(rows(history).nth(1)).toContainText("$12.50");

  const conflicts = card(page, "Allergy Conflicts");
  await expect(conflicts).toContainText("No allergy conflicts.");
  await cardAddButton(conflicts).click();
  form = dialog(page, "Add Allergy Conflict");
  await choose(form, "Allergy", allergy.name, allergy.name);
  await input(form, "Notes").fill("Contains latex");
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expectToast(page, "Conflict added.");
  await expect(rows(conflicts, allergy.name)).toContainText("Contains latex");
  await rowAction(rows(conflicts, allergy.name), "Edit");
  form = dialog(page, "Edit Allergy Conflict");
  await input(form, "Notes").fill("Latex gloves");
  await form.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "Conflict updated.");
  await expect(rows(conflicts, allergy.name)).toContainText("Latex gloves");
  await rowAction(rows(conflicts, allergy.name), "Delete");
  await confirm(page, "Remove conflict?", "Remove");
  await expectToast(page, "Conflict removed.");
  await expect(conflicts).toContainText("No allergy conflicts.");
});

test("a category in use can't be deleted; an empty one can", async ({ page, guards, scenario }) => {
  const used = await scenario.productCategory();
  const empty = await scenario.productCategory();
  await scenario.product({ categoryId: used.id });
  guards.expectError("409 DELETE /api/product-categories/:id");

  await page.goto("/inventory/categories");
  const categories = card(page, "Categories");
  await searchList(categories, used.name);
  await rowAction(rows(categories, used.name), "Delete");
  await confirm(page, "Delete category?", "Delete");
  await expectToast(page, "Can't delete category while it's in use");

  await searchList(categories, empty.name);
  await rowAction(rows(categories, empty.name), "Delete");
  await confirm(page, "Delete category?", "Delete");
  await expectToast(page, "Category deleted.");
  await expect(rows(categories, empty.name)).toHaveCount(0);
});

test.describe("product invoices", () => {
  test("the card lists sales and purchases; the nurse's session reads them through the API while the page hides them", async ({ page, openPage, runtime, scenario }) => {
    const [product, supplier, patient] = await Promise.all([scenario.product(), scenario.supplier(), scenario.patient()]);
    const purchase = await scenario.supplierInvoice(supplier.id, [{ productId: product.id, quantity: 4, amount: 40 }]);
    const sale = await scenario.clientInvoice(patient.id, [{ itemType: "product", itemId: product.id, quantity: 1, amount: 20 }]);

    await page.goto(`/inventory/products/${product.id}`);
    const invoices = card(page, "Invoices");
    await expect(rows(invoices, `#${purchase.invoiceNumber}`).filter({ hasText: "Purchase" })).toContainText("$40.00");
    await expect(rows(invoices, `#${sale.invoiceNumber}`).filter({ hasText: "Sale" })).toContainText("$20.00");

    const nurse = await openPage(runtime.sessions.nurse);
    await nurse.goto(`/inventory/products/${product.id}`);
    await expect(nurse.getByRole("heading", { level: 2 })).toHaveText(product.name);
    await expect(card(nurse, "Pricing History")).toBeVisible();
    await expect(nurse.locator('[data-slot="card-title"]').filter({ hasText: /^Invoices$/ })).toHaveCount(0);
    const fromNurse = await nurse.evaluate(async (id) => {
      const res = await fetch(`/api/products/${id}/invoices`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } });
      const body = await res.json();
      const items: { invoiceNumber: number }[] = Array.isArray(body.Data) ? body.Data : (body.Data?.items ?? []);
      return { status: res.status, numbers: items.map((i) => i.invoiceNumber) };
    }, product.id);
    expect(fromNurse.status).toBe(200);
    expect(fromNurse.numbers.sort()).toEqual([purchase.invoiceNumber, sale.invoiceNumber].sort());
  });
});
