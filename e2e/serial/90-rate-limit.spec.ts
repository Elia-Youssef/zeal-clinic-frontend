import { expect, test } from "../support/fixtures";

// Last of all: it uses up the sign-in allowance of this IP, so nothing may sign in after it for a while.
test("repeated sign-ins hit the rate limit and the form says so", async ({ page, guards, scenario }) => {
  guards.expectError("401 POST /api/auth/login");
  guards.expectError("429 POST /api/auth/login");
  const username = scenario.tag();
  await page.goto("/");
  const message = page.locator("form p");
  let status = 0;
  for (let attempt = 0; attempt < 30 && status !== 429; attempt++) {
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page.getByLabel("Password", { exact: true }).fill(`wrong-${attempt}`);
    const response = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/auth/login");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    status = (await response).status();
    if (status === 401) await expect(message).toHaveText("Invalid username or password");
  }
  expect(status).toBe(429);
  await expect(message).toHaveText("Too many login attempts, please try again later");
});
