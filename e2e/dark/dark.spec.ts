import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import type { Scenario } from "../support/scenario";
import { confirm, expectToast, input, openDialog } from "../support/ui";

// The browser reports a dark color scheme here.
test.use({ role: "staff" });

const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));

async function createPatient(page: Page, scenario: Scenario): Promise<void> {
  await page.goto("/patients/list");
  const form = await openDialog(page, "New Patient", page.getByRole("button", { name: "New", exact: true }));
  await input(form, "First Name").fill(scenario.name("").trim());
  await input(form, "Last Name").fill("Patient");
  await input(form, "Contact").fill(scenario.phone());
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await confirm(page, "Create patient with minimal info?", "Create");
  await expectToast(page, "Patient created.");
}

test("the main pages render in the dark theme", async ({ page }) => {
  await page.goto("/dashboard");
  expect(await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true);
  for (const [path, title] of [
    ["/dashboard", "Dashboard"],
    ["/patients/list", "Patients"],
    ["/schedule/calendar", "Schedule"],
    ["/inventory/products", "Inventory"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    expect(await isDark(page)).toBe(true);
  }
});

test("toasts follow the app theme, light once the app switches to light, whatever the system scheme", async ({ page, scenario }) => {
  await createPatient(page, scenario);
  await expect(page.locator("[data-sonner-toaster]").first()).toHaveAttribute("data-sonner-theme", "dark");

  await page.getByRole("button", { name: "Staff menu" }).click();
  await page.getByRole("menuitem", { name: "Light mode" }).click();
  await page.keyboard.press("Escape");
  expect(await isDark(page)).toBe(false);
  await createPatient(page, scenario);
  await expect(page.locator("[data-sonner-toaster]").first()).toHaveAttribute("data-sonner-theme", "light");
});
