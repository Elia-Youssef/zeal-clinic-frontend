import type { Page } from "@playwright/test";
import { apiRequest, type Session } from "../support/api";
import { expect, test } from "../support/fixtures";
import type { Scenario } from "../support/scenario";

// Real server events over /api/events; each test signs in an account of its own, so its bell only
// counts what the test sends it.

/** The bell in the header (the other popover trigger there is the small-screen search). */
const bell = (page: Page) => page.locator('header [data-slot="popover-trigger"]').filter({ hasNotText: "Search" });

async function signedInUser(scenario: Scenario, openPage: (s: Session | null) => Promise<Page>) {
  const user = await scenario.user("admin");
  const session = await scenario.signIn(user.username, user.password);
  const page = await openPage(session);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  return { user, session, page };
}

const sendTest = (scenario: Scenario, session: Session) => apiRequest(scenario.baseURL, session.token, "POST", "/notifications/test");
const unread = (scenario: Scenario, session: Session) => apiRequest<number>(scenario.baseURL, session.token, "GET", "/notifications/unread-count");

test("live notifications: the bell counts them; mark read, delete, mark all read", async ({ openPage, scenario }) => {
  const { session, page } = await signedInUser(scenario, openPage);
  await expect(bell(page)).toHaveText("");
  for (let i = 0; i < 3; i++) await sendTest(scenario, session);
  await expect(bell(page)).toHaveText("3");

  await bell(page).click();
  const panel = page.locator('[data-slot="popover-content"][data-open]');
  await expect(panel).toContainText("Notifications");
  const items = panel.getByText("Test notification", { exact: true });
  await expect(items).toHaveCount(3);

  await items.first().click();
  await expect(bell(page)).toHaveText("2");
  expect(await unread(scenario, session)).toBe(2);

  // One delete button per item, in list order.
  await panel.getByRole("button", { name: "Delete notification" }).nth(1).click();
  await expect(items).toHaveCount(2);
  await expect(bell(page)).toHaveText("1");

  await panel.getByRole("button", { name: "Mark all read" }).click();
  await expect(bell(page)).toHaveText("");
  await expect(panel.getByRole("button", { name: "Mark all read" })).toHaveCount(0);
  expect(await unread(scenario, session)).toBe(0);
});

test("a low-stock notice arrives when an invoice brings stock down to the threshold", async ({ openPage, scenario }) => {
  const { page } = await signedInUser(scenario, openPage);
  const [product, patient] = await Promise.all([scenario.product({ quantity: 5, minThreshold: 3 }), scenario.patient()]);
  await scenario.clientInvoice(patient.id, [{ itemType: "product", itemId: product.id, quantity: 2, amount: 40 }]);

  await expect(bell(page)).toHaveText("1");
  await bell(page).click();
  const panel = page.locator('[data-slot="popover-content"][data-open]');
  await expect(panel).toContainText(`Low stock: ${product.name}`);
  await expect(panel).toContainText("Quantity 3 at or below min threshold 3.");
});

test("the hello event on reconnect refreshes the unread count", async ({ openPage, scenario }) => {
  const { session, page } = await signedInUser(scenario, openPage);
  await sendTest(scenario, session);
  await sendTest(scenario, session);
  await expect(bell(page)).toHaveText("2");
  // Marked read elsewhere: no event tells this tab, so the count stays until the stream reconnects.
  const list = await apiRequest<{ items: { id: string }[] }>(scenario.baseURL, session.token, "GET", "/notifications");
  await apiRequest(scenario.baseURL, session.token, "PUT", `/notifications/${list.items[0].id}/read`);
  await expect(bell(page)).toHaveText("2");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(bell(page)).toHaveText("1");
});

test("the stream opens with hello and cloud_connection false; the status dot shows the warning color", async ({ openPage, scenario }) => {
  const { page } = await signedInUser(scenario, openPage);
  const events = await page.evaluate(async () => {
    const controller = new AbortController();
    const res = await fetch("/api/events", {
      headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      signal: controller.signal,
    });
    const reader = res.body!.getReader();
    let text = "";
    while (!text.includes("event: cloud_connection")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    controller.abort();
    return { type: res.headers.get("content-type"), text };
  });
  expect(events.type).toContain("text/event-stream");
  expect(events.text).toMatch(/^event: hello\ndata: null\n\nevent: cloud_connection\ndata: false\n\n/);

  // The dot next to the avatar takes the theme's warning color for "cloud not connected".
  const colors = () =>
    page.getByRole("button", { name: "Staff menu" }).evaluate((button) => {
      const dot = [...button.children].find((c) => c.tagName === "SPAN" && !c.hasAttribute("data-slot")) as HTMLElement;
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--warning)";
      document.body.append(probe);
      const warning = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return getComputedStyle(dot).backgroundColor === warning;
    });
  await expect.poll(colors).toBe(true);
});

test("an account disabled by an admin is signed out live", async ({ openPage, guards, scenario }) => {
  guards.expectError("401 * /api/*");
  guards.expectPageError(/^Session expired$/);
  const user = await scenario.user("nurse");
  const nurse = await openPage(await scenario.signIn(user.username, user.password));
  await nurse.goto("/patients/list");
  await expect(nurse.getByRole("heading", { level: 1 })).toHaveText("Patients");
  await scenario.put(`/users/${user.id}`, { isActive: false });
  await nurse.waitForURL((url) => url.pathname === "/");
  await expect(nurse.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(await nurse.evaluate(() => sessionStorage.getItem("token"))).toBeNull();
});
