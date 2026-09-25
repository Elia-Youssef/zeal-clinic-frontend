import type { Page } from "@playwright/test";
import type { Role } from "../support/demo-credentials";
import { expect, test } from "../support/fixtures";
import { capturePdf, expectPdf } from "../support/pdf";
import { addDays, clinicDay } from "../support/time";
import { pickDate } from "../support/ui";

// Every dashboard card and the scopes it needs besides analytics:read (src/pages/dashboard.tsx).
const CARDS: [string, string[]][] = [
  ["Financial", ["balances:read", "reports:read"]],
  ["Patients", ["patients:read"]],
  ["Operations", ["appointments:read"]],
  ["Demographics", ["patients:read"]],
  ["Appointment Status", ["appointments:read"]],
  ["Inventory", ["products:read"]],
  ["Revenue & Payment Mix", ["balances:read", "reports:read"]],
  ["Referral Sources", ["patients:read"]],
  ["Staff Performance", ["employees:read"]],
  ["Top Procedures", ["procedures:read"]],
  ["Top Products", ["products:read"]],
  ["Room Utilization", ["rooms:read"]],
  ["Today's Appointments", ["appointments:read"]],
  ["Recent Transactions", ["balances:read", "reports:read"]],
];
const PDF_SCOPES = ["analytics:read", "balances:read", "patients:read", "appointments:read", "products:read", "reports:read"];

const cardTitles = (page: Page) =>
  page.locator('main[data-slot="sidebar-inset"] [data-slot="card-title"]').evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ""));

const printed = (day: string) => day.split("-").reverse().join("/");

for (const role of ["admin", "staff", "nurse"] as Role[]) {
  test.describe(`${role} dashboard`, () => {
    test.use({ role });

    test(`shows the cards the ${role} role's scopes allow`, async ({ page, session }) => {
      const scopes = session!.scopes;
      const expected = scopes.includes("analytics:read")
        ? CARDS.filter(([, needs]) => needs.every((s) => scopes.includes(s))).map(([title]) => title)
        : [];
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
      await expect.poll(async () => (await cardTitles(page)).sort()).toEqual([...expected].sort());
      await expect(page.getByRole("button", { name: "Print" })).toHaveCount(PDF_SCOPES.every((s) => scopes.includes(s)) ? 1 : 0);
    });
  });
}

test.describe("admin", () => {
  test.use({ role: "admin" });

  test("a fixed date range drives the requests; hidden cards stay hidden across reloads", async ({ page }) => {
    const to = clinicDay();
    const from = addDays(to, -7);
    await page.goto("/dashboard");
    const money = page.waitForRequest((r) => {
      const url = new URL(r.url());
      return url.pathname === "/api/analytics/money" && !!url.searchParams.get("from") && new Date(url.searchParams.get("from")!).getTime() > Date.now() - 9 * 86_400_000;
    });
    // To stays on today, its default.
    await pickDate(page, "From", from);
    const request = new URL((await money).url());
    const sent = { from: request.searchParams.get("from")!, to: request.searchParams.get("to")! };
    // Midnight of the From day and of the day after To, on the clinic's clock.
    expect(new Date(sent.to).getTime() - new Date(sent.from).getTime()).toBeGreaterThanOrEqual(8 * 86_400_000 - 3_600_000);
    expect(new Date(sent.to).getTime() - new Date(sent.from).getTime()).toBeLessThanOrEqual(8 * 86_400_000 + 3_600_000);

    await page.getByRole("button", { name: "Customize" }).click();
    await page.getByRole("checkbox", { name: "Inventory", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Inventory$/ })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("dashboard-layout"))).toContain("inventory");

    await page.reload();
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Financial$/ })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Inventory$/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Customize" }).click();
    await expect(page.getByRole("checkbox", { name: "Inventory", exact: true })).not.toBeChecked();
    await page.getByRole("button", { name: "Show all" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Inventory$/ })).toBeVisible();
  });

  test("prints the analytics PDF for the chosen range", async ({ page }) => {
    const to = clinicDay();
    const from = addDays(to, -14);
    await page.goto("/dashboard");
    await pickDate(page, "From", from);
    const pdf = await capturePdf(page, () => page.getByRole("button", { name: "Print" }).click());
    // The extracted text has its runs of spaces collapsed.
    expectPdf(pdf, ["Analytics Report", `${printed(from)} — ${printed(to)}`, "Financial", "Appointment Status", "Top Procedures (by revenue)"]);
  });
});
