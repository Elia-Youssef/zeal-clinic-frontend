import { expect, test } from "../support/fixtures";
import { card, confirm, expectToast, input, openDialog, rows, searchList } from "../support/ui";

// 390 x 844: below the 842 px breakpoint the sidebar becomes a sheet.
test.use({ role: "nurse" });

test("the navigation sheet opens from the header and closes after a pick", async ({ page }) => {
  await page.goto("/dashboard");
  const sheet = page.locator('[data-slot="sidebar"][data-mobile="true"]');
  await expect(sheet).toHaveCount(0);
  await openDialog(page, "Sidebar", page.getByRole("button", { name: "Toggle Sidebar" }));
  await expect(sheet.getByRole("link", { name: "Schedule" })).toBeVisible();
  await sheet.getByRole("link", { name: "Patients" }).click();
  await page.waitForURL("**/patients/list");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Patients");
});

test("a full flow on a phone: create a patient, then open the record", async ({ page, scenario }) => {
  const firstName = scenario.name("").trim();
  await page.goto("/patients/list");
  const list = card(page, "Patients");
  const form = await openDialog(page, "New Patient", list.getByRole("button", { name: "New", exact: true }));
  await expect(form.getByRole("button", { name: /^Drafts \(\d+\)$/ })).toBeVisible();
  await input(form, "First Name").fill(firstName);
  await input(form, "Last Name").fill("Patient");
  await input(form, "Contact").fill(scenario.phone());
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await confirm(page, "Create patient with minimal info?", "Create");
  await expectToast(page, "Patient created.");

  await searchList(list, firstName);
  await rows(list, `${firstName} Patient`).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(`${firstName} Patient`);
  await expect(card(page, "Details")).toBeVisible();
});
