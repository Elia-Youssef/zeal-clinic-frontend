import type { Page } from "@playwright/test";
import { apiGet, apiLogout, ApiError, throwawayPassword } from "../support/api";
import { browserState, signInWithForm, signOut } from "../support/auth";
import { expect, test } from "../support/fixtures";
import { dialog, input } from "../support/ui";

/** The message under the sign-in fields. */
const loginError = (page: Page) => page.locator("form p");

// Sign-ins are rate limited per IP for the whole run, so these tests may wait for the limiter.
test.describe.configure({ timeout: 180_000 });

test.describe("sign-in form", () => {
  test("signs in and opens the dashboard", async ({ page, guards, scenario }) => {
    const user = await scenario.user("staff");
    await page.goto("/");
    expect(await signInWithForm(page, guards, user.username, user.password)).toBe(200);
    await page.waitForURL("**/dashboard");
    await expect(page.locator('[data-slot="sidebar-header"]')).toContainText(user.displayName);
    expect((await browserState(page)).token).toBeTruthy();
  });

  test("a wrong password shows the error and stays on the form", async ({ page, guards, scenario }) => {
    const user = await scenario.user("staff");
    guards.expectError("401 POST /api/auth/login");
    await page.goto("/");
    expect(await signInWithForm(page, guards, user.username, `${user.password}x`)).toBe(401);
    await expect(loginError(page)).toHaveText("Invalid username or password");
    expect(new URL(page.url()).pathname).toBe("/");
    expect((await browserState(page)).token).toBeNull();
  });

  test("a disabled account can't sign in", async ({ page, guards, scenario }) => {
    const user = await scenario.user("nurse");
    await scenario.put(`/users/${user.id}`, { isActive: false });
    guards.expectError("403 POST /api/auth/login");
    await page.goto("/");
    expect(await signInWithForm(page, guards, user.username, user.password)).toBe(403);
    await expect(loginError(page)).toHaveText("Your account is disabled");
  });

  test("returns to the page asked for before signing in", async ({ page, guards, scenario }) => {
    const user = await scenario.user("staff");
    await page.goto("/patients/list?x=1");
    await page.waitForURL((url) => url.pathname === "/");
    await signInWithForm(page, guards, user.username, user.password);
    await page.waitForURL((url) => url.pathname === "/patients/list" && url.search === "?x=1");
  });

  test("never returns to an outside address", async ({ page, guards, scenario }) => {
    const user = await scenario.user("staff");
    for (const target of ["//outside.example.com/x", "https://outside.example.com/"]) {
      await page.goto("/");
      await page.evaluate((value) => sessionStorage.setItem("auth_redirect", value), target);
      await signInWithForm(page, guards, user.username, user.password);
      await page.waitForURL("**/dashboard");
      expect(new URL(page.url()).origin).toBe(new URL(scenario.baseURL).origin);
      await signOut(page);
    }
  });

  test("the first sign-in sets the password of an account created without one", async ({ page, guards, scenario }) => {
    const username = scenario.tag();
    await scenario.post("/users", { username, displayName: scenario.name("Staff"), role: "staff" });
    const chosen = throwawayPassword();
    guards.expectError("401 POST /api/auth/login");
    await page.goto("/");
    expect(await signInWithForm(page, guards, username, chosen)).toBe(200);
    await page.waitForURL("**/dashboard");
    await signOut(page);
    expect(await signInWithForm(page, guards, username, throwawayPassword())).toBe(401);
    await expect(loginError(page)).toHaveText("Invalid username or password");
    expect(await signInWithForm(page, guards, username, chosen)).toBe(200);
    await page.waitForURL("**/dashboard");
  });

  test("the super-admin keeps the password its first sign-in set", async ({ page, guards, runtime }) => {
    guards.expectError("401 POST /api/auth/login");
    await page.goto("/");
    expect(await signInWithForm(page, guards, runtime.users["super-admin"], `${runtime.passwords["super-admin"]}-not`)).toBe(401);
    expect(await signInWithForm(page, guards, runtime.users["super-admin"], runtime.passwords["super-admin"])).toBe(200);
    await page.waitForURL("**/dashboard");
  });
});

test.describe("sessions", () => {
  test.use({ role: "staff", ownSession: true });

  test("signing out goes back to the form and revokes the token", async ({ page, guards, runtime, session }) => {
    await page.goto("/dashboard");
    await signOut(page);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect((await browserState(page)).token).toBeNull();
    const revoked = await apiGet(runtime.baseURL, session!.token, "/auth/verify").catch((e: ApiError) => e);
    expect(revoked).toBeInstanceOf(ApiError);
    expect((revoked as ApiError).status).toBe(401);
  });

  test("a session revoked on the server sends the tab back to sign-in and clears the drafts", async ({ page, guards, runtime, session, scenario }) => {
    guards.expectError("401 * /api/*");
    // Today the page that made the call also throws "Session expired" uncaught while the tab reloads.
    guards.expectPageError(/^Session expired$/);
    await page.goto("/patients/list");
    await page.getByRole("button", { name: "New", exact: true }).click();
    const form = dialog(page, "New Patient");
    const draftName = scenario.name("Draft");
    await input(form, "First Name").fill(draftName);
    await expect.poll(async () => (await browserState(page)).drafts ?? "").toContain(draftName);
    await form.getByRole("button", { name: "Cancel" }).click();

    await apiLogout(runtime.baseURL, session!.token);
    await page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Schedule" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    const state = await browserState(page);
    expect(state.token).toBeNull();
    expect(state.drafts ?? "").not.toContain(draftName);
  });
});

test.describe("per-tab sessions", () => {
  test("a new tab starts signed out; a tab the app opens itself shares the session", async ({ page, guards, scenario, context }) => {
    const user = await scenario.user("staff");
    await page.goto("/");
    await signInWithForm(page, guards, user.username, user.password);
    await page.waitForURL("**/dashboard");

    const fresh = await context.newPage();
    await fresh.goto("/dashboard");
    await fresh.waitForURL((url) => url.pathname === "/");
    await expect(fresh.getByRole("button", { name: "Sign in" })).toBeVisible();

    const [detached] = await Promise.all([
      context.waitForEvent("page"),
      page.evaluate(() => window.open("/patients/list", "_blank", "noopener")),
    ]);
    await detached.waitForURL((url) => url.pathname === "/");
    await expect(detached.getByRole("button", { name: "Sign in" })).toBeVisible();

    const [opened] = await Promise.all([context.waitForEvent("page"), page.evaluate(() => window.open("/patients/list"))]);
    await opened.waitForURL("**/patients/list");
    expect(await opened.evaluate(() => sessionStorage.getItem("token"))).toBeTruthy();

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
