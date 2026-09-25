import type { Page } from "@playwright/test";
import type { Guards } from "./guards";

// Structural anchors only: data-slot attributes, element names and accessible roles.
const INSET = 'main[data-slot="sidebar-inset"]';
const CONTENT = `${INSET} > div`;
/** The full-screen loading overlay (src/components/shared/loading-overlay.tsx) sits right under #root. */
const OVERLAY = '#root > [role="status"]';

/**
 * Waits until the page is quiet: no loading overlay, no API request in flight and the same URL for
 * `quietMs` in a row. Redirects and follow-up requests restart the count.
 */
export async function settle(page: Page, guards: Guards, { quietMs = 500, timeoutMs = 15_000 } = {}): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let url = page.url();
  let quietSince = Date.now();
  while (Date.now() < deadline) {
    const busy = guards.pendingRequests() > 0 || (await page.locator(OVERLAY).count()) > 0;
    if (busy || page.url() !== url) {
      url = page.url();
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= quietMs) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`the page did not settle within ${timeoutMs} ms (at ${page.url()}, ${guards.pendingRequests()} API requests pending)`);
}

/** The title in the app header. */
export async function readTitle(page: Page): Promise<string | undefined> {
  const title = page.locator(`${INSET} > header h1`);
  if ((await title.count()) === 0) return undefined;
  return ((await title.first().textContent()) ?? "").trim() || undefined;
}

/** Visible sidebar entries as "Group: Item" (ungrouped entries without a prefix). */
export async function readSidebar(page: Page): Promise<string[] | null> {
  return page.evaluate(() => {
    const sidebar = document.querySelector('[data-slot="sidebar"]:not([data-mobile]) [data-slot="sidebar-content"]');
    if (!sidebar) return null;
    const items: string[] = [];
    for (const group of sidebar.querySelectorAll('[data-slot="sidebar-group"]')) {
      const first = group.firstElementChild;
      const label =
        group.querySelector('[data-slot="sidebar-group-label"], [data-sidebar="group-label"]') ??
        (first && !first.matches('[data-slot="sidebar-group-content"]') ? first : null);
      const prefix = label?.textContent?.trim();
      for (const link of group.querySelectorAll("a")) {
        const text = link.textContent?.trim() ?? "";
        items.push(prefix ? `${prefix}: ${text}` : text);
      }
    }
    return items;
  });
}

/** Labels of the tab links in the page content that point at one of `paths`, in page order. */
export async function readTabs(page: Page, paths: string[]): Promise<string[]> {
  return page.evaluate(
    ({ selector, paths }) => {
      const content = document.querySelector(selector);
      if (!content) return [];
      return [...content.querySelectorAll("a[href]")]
        .filter((a) => paths.includes(new URL((a as HTMLAnchorElement).href).pathname))
        .map((a) => a.textContent?.trim() ?? "");
    },
    { selector: CONTENT, paths },
  );
}

/** Visible "New", "Edit" and "Delete" buttons in the page content, in page order. */
export async function readActions(page: Page): Promise<string[]> {
  const buttons = page.locator(CONTENT).getByRole("button", { name: /^(New|Edit|Delete)$/ });
  return buttons.evaluateAll((elements) =>
    elements
      .filter((el) => (el as HTMLElement).checkVisibility())
      .map((el) => el.textContent?.trim() ?? ""),
  );
}
