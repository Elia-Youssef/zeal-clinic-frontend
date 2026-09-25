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

test("types, nested categories, a procedure with price history, inclusions and the active flag, allergy conflicts", async ({ page, scenario }) => {
  const type = scenario.name("Type");
  const parent = scenario.name("Category");
  const child = scenario.name("Category");
  const procedure = scenario.name("Procedure");
  const allergy = await scenario.allergy();

  await page.goto("/services/types");
  const types = card(page, "Procedure Types");
  await types.getByRole("button", { name: "New", exact: true }).click();
  let form = dialog(page, "New Procedure Type");
  await input(form, "Name").fill(type);
  await input(form, "Description").fill("Made by the tests");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Procedure type created.");
  await searchList(types, type);
  await expect(rows(types, type)).toContainText("Made by the tests");

  await page.goto("/services/categories");
  const categories = card(page, "Procedure Categories");
  await categories.getByRole("button", { name: "New", exact: true }).click();
  form = dialog(page, "New Procedure Category");
  await input(form, "Name").fill(parent);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Category created.");
  await categories.getByRole("button", { name: "New", exact: true }).click();
  form = dialog(page, "New Procedure Category");
  await input(form, "Name").fill(child);
  await choose(form, "Parent Category", parent, parent);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Category created.");
  await searchList(categories, child);
  await expect(rows(categories, child)).toContainText(parent);

  await page.goto("/services/procedures");
  const procedures = card(page, "Procedures");
  await procedures.getByRole("button", { name: "New", exact: true }).click();
  form = dialog(page, "New Procedure");
  await input(form, "Name").fill(procedure);
  await input(form, "Price").fill("350");
  await input(form, "Price Note").fill("per session");
  await choose(form, "Type", type, type);
  await choose(form, "Category", child, child);
  await input(form, "Includes").fill("Face, Neck");
  await input(form, "Remarks").fill("Numbing cream first");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Procedure created.");
  await searchList(procedures, procedure);
  const row = rows(procedures, procedure);
  await expect(row).toContainText(type);
  await expect(row).toContainText(parent);
  await expect(row).toContainText(child);
  await expect(row).toContainText("$350.00 - per session");

  await row.click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(procedure);
  await expect(detail(page, "Price")).toContainText("$350.00 - per session");
  await expect(detail(page, "Type")).toContainText(type);
  await expect(detail(page, "Includes")).toContainText("Face, Neck");
  await expect(detail(page, "Remarks")).toContainText("Numbing cream first");
  const history = card(page, "Pricing History");
  await expect(rows(history)).toHaveCount(1);

  const id = new URL(page.url()).pathname.split("/").pop()!;
  const pick = async () => scenario.get<{ id: string }[]>(`/procedures/dropdown?limit=7&filter=${encodeURIComponent(procedure)}`);
  expect((await pick()).map((p) => p.id)).toEqual([id]);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  form = dialog(page, "Edit Procedure");
  await expect(form.getByRole("checkbox", { name: "Active" })).toBeChecked();
  await input(form, "Price").fill("400");
  await form.getByRole("checkbox", { name: "Active" }).click();
  await form.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "Procedure updated.");
  await expect(detail(page, "Price")).toContainText("$400.00 - per session");
  await expect(rows(history)).toHaveCount(2);
  await expect(rows(history).first()).toContainText("Current");
  await expect(rows(history).first()).toContainText("$400.00");
  // Inactive procedures leave the pickers (appointments, invoices) but stay in the list. An empty
  // dropdown answers null rather than [].
  expect(await pick()).toBeNull();
  await page.goto("/services/procedures");
  await searchList(card(page, "Procedures"), procedure);
  await expect(rows(card(page, "Procedures"), procedure)).toHaveCount(1);

  await page.goto(`/services/procedures/${id}`);
  const conflicts = card(page, "Allergy Conflicts");
  await cardAddButton(conflicts).click();
  form = dialog(page, "Add Allergy Conflict");
  await choose(form, "Allergy", allergy.name, allergy.name);
  await input(form, "Notes").fill("Avoid lidocaine");
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await expectToast(page, "Conflict added.");
  await expect(rows(conflicts, allergy.name)).toContainText("Avoid lidocaine");
  await rowAction(rows(conflicts, allergy.name), "Delete");
  await confirm(page, "Remove conflict?", "Remove");
  await expectToast(page, "Conflict removed.");
  await expect(conflicts).toContainText("No allergy conflicts.");
});

test("a type in use can't be deleted", async ({ page, guards, scenario }) => {
  const type = await scenario.procedureType();
  await scenario.procedure({ typeId: type.id });
  guards.expectError("409 DELETE /api/procedure-types/:id");
  await page.goto("/services/types");
  const types = card(page, "Procedure Types");
  await searchList(types, type.name);
  await rowAction(rows(types, type.name), "Delete");
  await confirm(page, "Delete procedure type?", "Delete");
  await expectToast(page, "Can't delete type while it's in use");
});
