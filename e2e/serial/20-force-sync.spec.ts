import { expect, test } from "../support/fixtures";
import { card, confirm, expectToast } from "../support/ui";

// Restore progress is broadcast to every open tab, so this runs alone.
test.use({ role: "admin" });

test("force sync on a clinic without a cloud peer reports that sync isn't configured", async ({ page, guards }) => {
  guards.expectError("409 POST /api/cloud-restore");
  await page.goto("/settings/about");
  const about = card(page, "Zeal Clinic");
  await expect(about).toContainText("Cloud synchronization");
  await about.getByRole("button", { name: "Force sync" }).click();
  await expect(page.getByRole("alertdialog", { name: "Force cloud sync?" })).toContainText(
    "Any changes in the cloud will be overwritten by this local instance. This cannot be undone.",
  );
  await confirm(page, "Force cloud sync?", "Force sync");

  await expectToast(page, "Cloud sync is not configured");
  const progress = page.getByRole("alertdialog", { name: "Cloud restore failed" });
  await expect(progress).toContainText("The cloud restore stopped before it could finish.");
  await expect(progress).toContainText("Cloud sync is not configured");
  await expect(progress).toContainText("1/5");
  await progress.getByRole("button", { name: "Dismiss" }).click();
  await expect(progress).toBeHidden();
});
