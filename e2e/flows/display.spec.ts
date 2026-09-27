import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { confirm, dialog, expectToast, input } from "../support/ui";

test.use({ role: "staff" });

const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));
const uiSettings = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("ui-settings") ?? "{}").state ?? null) as Promise<{
    theme: string;
    scale: number;
    sidebarOpen: boolean;
  } | null>;

async function openStaffMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Staff menu" }).click();
}

test("the theme starts dark, toggles to light and stays light after a reload", async ({ page }) => {
  await page.goto("/dashboard");
  expect(await isDark(page)).toBe(true);
  await openStaffMenu(page);
  await page.getByRole("menuitem", { name: "Light mode" }).click();
  expect(await isDark(page)).toBe(false);
  await expect(page.getByRole("menuitem", { name: "Dark mode" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect((await uiSettings(page))?.theme).toBe("light");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  expect(await isDark(page)).toBe(false);
});

test("toasts follow the app theme, not the system color scheme", async ({ page, scenario }) => {
  await page.goto("/patients/list");
  expect(await isDark(page)).toBe(true);
  await page.getByRole("button", { name: "New", exact: true }).click();
  const form = dialog(page, "New Patient");
  await input(form, "First Name").fill(scenario.name("").trim());
  await input(form, "Last Name").fill("Patient");
  await input(form, "Contact").fill(scenario.phone());
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await confirm(page, "Create patient with minimal info?", "Create");
  await expectToast(page, "Patient created.");
  // Playwright's default scheme is light: the toasts are dark like the app all the same.
  await expect(page.locator("[data-sonner-toaster]").first()).toHaveAttribute("data-sonner-theme", "dark");
});

test("the UI zoom goes from 80% to 170% and stays after a reload", async ({ page }) => {
  await page.goto("/dashboard");
  const rootSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(await rootSize()).toBe("16px");
  await openStaffMenu(page);
  // Today the scale slider has two thumbs for its one value (the slider component draws one per end).
  await expect(page.getByRole("slider")).toHaveCount(2);
  const slider = page.getByRole("slider").first();
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(page.getByText("80%", { exact: true })).toBeVisible();
  await expect.poll(rootSize).toBe("12.8px");
  await page.keyboard.press("End");
  await expect(page.getByText("170%", { exact: true })).toBeVisible();
  await expect.poll(rootSize).toBe("27.2px");
  await page.keyboard.press("Escape");
  expect((await uiSettings(page))?.scale).toBeCloseTo(1.7);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  expect(await rootSize()).toBe("27.2px");
});

test("Ctrl+B collapses the sidebar and the choice is kept", async ({ page }) => {
  await page.goto("/dashboard");
  const sidebar = page.locator('[data-slot="sidebar"]:not([data-mobile])').first();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await page.keyboard.press("Control+b");
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  expect((await uiSettings(page))?.sidebarOpen).toBe(false);
  await page.reload();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.keyboard.press("Control+b");
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
});
