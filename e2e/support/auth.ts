import type { Page } from "@playwright/test";
import type { Guards } from "./guards";

/**
 * Signs in through the login form and returns the status of the sign-in call. Sign-ins are rate
 * limited per IP for the whole run, so a 429 waits and submits again.
 */
export async function signInWithForm(page: Page, guards: Guards, username: string, password: string): Promise<number> {
  guards.expectError("429 POST /api/auth/login");
  for (let attempt = 1; ; attempt++) {
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const response = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/auth/login",
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const status = (await response).status();
    if (status !== 429 || attempt >= 12) return status;
    await page.waitForTimeout(7_000);
  }
}

/** Signs out through the staff menu. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Staff menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/** The session and drafts the dashboard keeps in the browser. */
export async function browserState(page: Page): Promise<{ token: string | null; drafts: string | null }> {
  return page.evaluate(() => ({ token: sessionStorage.getItem("token"), drafts: localStorage.getItem("form-drafts") }));
}
