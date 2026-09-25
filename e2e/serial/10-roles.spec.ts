import type { Page } from "@playwright/test";
import { readSidebar } from "../support/app";
import { apiRequest } from "../support/api";
import { expect, test } from "../support/fixtures";
import { card, expectToast } from "../support/ui";

// Role edits reach every signed-in account of that role, so they run here, one at a time.
test.use({ role: "admin" });

/** A permission cell of the role matrix: the resource's row, then read, write or delete. */
function permission(page: Page, resource: string, action: "read" | "write" | "delete") {
  const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: resource, exact: true }) });
  return row.getByRole("cell").nth({ read: 1, write: 2, delete: 3 }[action]).getByRole("checkbox");
}

test("a nurse sees a role change live, after the permissions overlay and without a reload", async ({ page, openPage, runtime }) => {
  const original = await apiRequest<{ scopes: string[] }>(runtime.baseURL, runtime.sessions.admin.token, "GET", "/roles/nurse");
  expect(original.scopes).not.toContain("suppliers:read");
  const nurse = await openPage(runtime.sessions.nurse);
  try {
    await nurse.goto("/dashboard");
    await expect(nurse.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
    expect(await readSidebar(nurse)).not.toContain("Business: Suppliers");
    // Remember whether the overlay showed up, and mark the document to prove it isn't reloaded.
    await nurse.evaluate(() => {
      const state = window as unknown as { e2eSawOverlay: boolean; e2eSameDocument: boolean };
      state.e2eSawOverlay = false;
      state.e2eSameDocument = true;
      new MutationObserver(() => {
        const overlay = document.querySelector('#root > [role="status"]');
        if (overlay?.textContent?.includes("Updating permissions")) state.e2eSawOverlay = true;
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });

    await page.goto("/settings/roles/nurse");
    const box = permission(page, "Suppliers", "read");
    await expect(box).not.toBeChecked();
    await box.click();
    await expect(card(page, "Permissions")).toContainText(`${original.scopes.length + 1} of 82 selected`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expectToast(page, "Role updated.");

    await expect.poll(() => readSidebar(nurse)).toContain("Business: Suppliers");
    expect(await nurse.evaluate(() => (window as unknown as { e2eSawOverlay: boolean }).e2eSawOverlay)).toBe(true);
    expect(await nurse.evaluate(() => (window as unknown as { e2eSameDocument?: boolean }).e2eSameDocument)).toBe(true);

    await permission(page, "Suppliers", "read").click();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expectToast(page, "Role updated.");
    await expect.poll(() => readSidebar(nurse)).not.toContain("Business: Suppliers");
  } finally {
    await apiRequest(runtime.baseURL, runtime.sessions.admin.token, "PUT", "/roles/nurse", { scopes: original.scopes });
  }
});

test("the admin role can't drop its own roles or users permissions", async ({ page, guards }) => {
  guards.expectError("400 PUT /api/roles/admin");
  await page.goto("/settings/roles/admin");
  const box = permission(page, "Roles", "read");
  await expect(box).toBeChecked();
  await box.click();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expectToast(page, "The admin role must keep roles:read");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(permission(page, "Roles", "read")).toBeChecked();
});
