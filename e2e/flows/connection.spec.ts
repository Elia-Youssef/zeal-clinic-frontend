import { apiGet } from "../support/api";
import { expect, test } from "../support/fixtures";
import { card } from "../support/ui";

test.use({ role: "nurse" });

test("shows the server address and its QR code", async ({ page, runtime }) => {
  const info = await apiGet<{ url: string; port: string; isCloud: boolean }>(runtime.baseURL, runtime.sessions.nurse.token, "/server-info");
  expect(info.isCloud).toBe(false);
  expect(info.url).toMatch(new RegExp(`^http://[^/]+:${new URL(runtime.baseURL).port}$`));

  await page.goto("/connection");
  const connect = card(page, "Connect a client");
  await expect(connect).toContainText("Other devices on the same network can connect to this server");
  await expect(connect.getByRole("img")).toBeVisible();
  expect(await connect.getByRole("img").evaluate((el) => el.tagName.toLowerCase())).toBe("svg");
  await expect(connect).toContainText("Server URL");
  await expect(connect.locator("code")).toHaveText(info.url);
});
