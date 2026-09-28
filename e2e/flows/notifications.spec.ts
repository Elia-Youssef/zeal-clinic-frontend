import type { Page } from "@playwright/test";
import { apiRequest, type Session } from "../support/api";
import { expect, test } from "../support/fixtures";
import type { Scenario } from "../support/scenario";

// Real server events over /api/events. Every active account also receives the low-stock and
// appointment notices that other specs raise meanwhile, so each test signs in with an account of its
// own, counts only its own notices (by title, in the panel and on the server) and checks the bell
// against the account's unread count on the server, never against a number of its own.

/** The bell in the header (the other popover trigger there is the small-screen search). */
const bell = (page: Page) => page.locator('header [data-slot="popover-trigger"]').filter({ hasNotText: "Search" });

const bellCount = async (page: Page) => Number((await bell(page).textContent())?.trim() || 0);

/** The notification panel, while it is open. */
const panel = (page: Page) => page.locator('[data-slot="popover-content"][data-open]');

/** The title of every notice the test route sends. */
const TEST_TITLE = "Test notification";

type Notice = { id: string; title: string; isRead: boolean };

/** A new account, signed in on the dashboard; returns once the bell has loaded its count. */
async function signedInUser(scenario: Scenario, openPage: (s: Session | null) => Promise<Page>) {
  const user = await scenario.user("admin");
  const session = await scenario.signIn(user.username, user.password);
  const page = await openPage(session);
  const bellLoaded = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/notifications/unread-count" && res.ok());
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await bellLoaded;
  return { session, page };
}

const sendTest = (scenario: Scenario, session: Session) => apiRequest(scenario.baseURL, session.token, "POST", "/notifications/test");
const unread = (scenario: Scenario, session: Session) => apiRequest<number>(scenario.baseURL, session.token, "GET", "/notifications/unread-count");

/** The account's notices with this title, as the server lists them (newest first). */
async function notices(scenario: Scenario, session: Session, title: string): Promise<Notice[]> {
  const list = await apiRequest<{ items: Notice[] }>(scenario.baseURL, session.token, "GET", "/notifications");
  return list.items.filter((n) => n.title === title);
}

/** How many notices the bell counts beyond the account's unread count on the server: 0 once it has caught up. */
const bellAhead = async (page: Page, scenario: Scenario, session: Session) => (await bellCount(page)) - (await unread(scenario, session));

/** Matches names that start with `text`. */
const startsWith = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

/**
 * The panel's rows for the notices with this title. A row's body is a button named by the title, plus
 * "Unread" while unread; its other button deletes it.
 */
function panelRows(page: Page, title: string) {
  const rows = panel(page).getByRole("listitem").filter({ has: page.getByRole("button", { name: startsWith(title) }) });
  return { rows, unreadRows: rows.filter({ has: page.getByRole("button", { name: /Unread$/ }) }) };
}

test("live notifications: the bell counts them; mark read, delete, mark all read", async ({ openPage, scenario }) => {
  const { session, page } = await signedInUser(scenario, openPage);
  for (let i = 0; i < 3; i++) await sendTest(scenario, session);
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(0);

  await bell(page).click();
  await expect(panel(page)).toContainText("Notifications");
  const { rows, unreadRows } = panelRows(page, TEST_TITLE);
  await expect(rows).toHaveCount(3);
  await expect(unreadRows).toHaveCount(3);

  await rows.first().getByRole("button", { name: startsWith(TEST_TITLE) }).click();
  await expect(unreadRows).toHaveCount(2);
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(0);

  // The second row is still unread, so deleting it takes one off the bell too.
  await rows.nth(1).getByRole("button", { name: "Delete notification" }).click();
  await expect(rows).toHaveCount(2);
  await expect(unreadRows).toHaveCount(1);
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(0);

  await panel(page).getByRole("button", { name: "Mark all read" }).click();
  await expect(unreadRows).toHaveCount(0);
  expect((await notices(scenario, session, TEST_TITLE)).map((n) => n.isRead)).toEqual([true, true]);
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(0);
});

test("a low-stock notice arrives when an invoice brings stock down to the threshold and leaves on restock", async ({ openPage, scenario }) => {
  const { session, page } = await signedInUser(scenario, openPage);
  const [product, patient, supplier] = await Promise.all([
    scenario.product({ quantity: 5, minThreshold: 3 }),
    scenario.patient(),
    scenario.supplier(),
  ]);
  await scenario.clientInvoice(patient.id, [{ itemType: "product", itemId: product.id, quantity: 2, amount: 40 }]);

  // The stock check runs after the invoice is answered, so the notice follows a moment later.
  const title = `Low stock: ${product.name}`;
  await expect.poll(async () => (await notices(scenario, session, title)).length).toBe(1);
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(0);
  await bell(page).click();
  const { rows } = panelRows(page, title);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Quantity 3 at or below min threshold 3.");

  // Restocked, the notice is deleted on the server, which tells the open tab: the row leaves the
  // panel and the bell stops counting it (it would stay one ahead of the server otherwise).
  await scenario.supplierInvoice(supplier.id, [{ productId: product.id, quantity: 10, amount: 50 }]);
  await expect.poll(async () => (await notices(scenario, session, title)).length).toBe(0);
  await expect(rows).toHaveCount(0);
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(0);
});

test("the hello event on reconnect refreshes the unread count", async ({ openPage, scenario }) => {
  const { session, page } = await signedInUser(scenario, openPage);
  await sendTest(scenario, session);
  await sendTest(scenario, session);
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(0);
  // Marked read elsewhere: no event tells this tab, so the bell counts it until the stream reconnects.
  const [newest] = await notices(scenario, session, TEST_TITLE);
  await apiRequest(scenario.baseURL, session.token, "PUT", `/notifications/${newest.id}/read`);
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => bellAhead(page, scenario, session)).toBe(0);
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
