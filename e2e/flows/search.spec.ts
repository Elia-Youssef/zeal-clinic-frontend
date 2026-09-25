import type { Page } from "@playwright/test";
import type { Role } from "../support/demo-credentials";
import { expect, test } from "../support/fixtures";

// Header search groups and the scope each needs, and the quick actions (src/components/layout/header-*.tsx).
const GROUPS: [string, string][] = [
  ["Patients", "patients:read"],
  ["Employees", "employees:read"],
  ["Suppliers", "suppliers:read"],
  ["Procedures", "procedures:read"],
  ["Products", "products:read"],
];
const QUICK_ACTIONS: [string, string[]][] = [
  ["New Patient", ["patients:write"]],
  ["New Appointment", ["appointments:write"]],
  ["New Invoice", ["invoices:write", "patients:read"]],
];

/** The header renders its search twice (wide and narrow layouts); only one is shown. */
async function search(page: Page, text: string): Promise<void> {
  await page.locator("header").getByPlaceholder("Search...", { exact: true }).filter({ visible: true }).fill(text);
}

for (const role of ["admin", "staff", "nurse"] as Role[]) {
  test.describe(`${role} header`, () => {
    test.use({ role });

    test(`search results and quick actions follow the ${role} role's scopes`, async ({ page, session, scenario }) => {
      const token = scenario.name("Find");
      const patient = await scenario.patient({ firstName: token });
      await Promise.all([
        scenario.employee({ firstName: token }),
        scenario.supplier({ name: `${token} Supplier` }),
        scenario.procedure({ name: `${token} Procedure` }),
        scenario.product({ name: `${token} Product` }),
      ]);
      const scopes = session!.scopes;
      const groups = GROUPS.filter(([, scope]) => scopes.includes(scope)).map(([group]) => group);

      await page.goto("/dashboard");
      await search(page, token);
      const header = page.locator("header");
      const hits = header.getByRole("button", { name: new RegExp(`^${token}`) });
      if (groups.length) {
        await expect(hits).toHaveCount(groups.length);
      } else {
        await expect(header.getByText("No results", { exact: true })).toBeVisible();
      }
      for (const [group] of GROUPS) {
        await expect(header.getByText(group, { exact: true })).toHaveCount(groups.includes(group) ? 1 : 0);
      }

      const actions = QUICK_ACTIONS.filter(([, needs]) => needs.every((s) => scopes.includes(s))).map(([label]) => label);
      if (actions.length) {
        await page.getByRole("button", { name: "Quick Action" }).click();
        await expect(page.getByRole("menuitem")).toHaveText(actions);
        await page.keyboard.press("Escape");
      } else {
        await expect(page.getByRole("button", { name: "Quick Action" })).toHaveCount(0);
      }

      if (groups.includes("Patients")) {
        await search(page, token);
        await header.getByRole("button", { name: new RegExp(`^${patient.fullName}`) }).click();
        await page.waitForURL(`**/patients/${patient.id}`);
      }
    });
  });
}
