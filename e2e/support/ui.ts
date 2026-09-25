import { expect, type Locator, type Page } from "@playwright/test";
import { pickerDayKey } from "./time";

// Page-object helpers. Most form labels aren't linked to their controls yet, so fields are found by
// the label text next to them; once they are, only these internals change to getByLabel.

type Scope = Page | Locator;

function pageOf(scope: Scope): Page {
  return "page" in scope && typeof scope.page === "function" ? scope.page() : (scope as Page);
}

function xpathLiteral(text: string): string {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  return `concat('${text.split("'").join(`', "'", '`)}')`;
}

function exactText(text: string): RegExp {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
}

/** The wrapper of a form field: the element whose own <label> reads `label` (a trailing " *" is ignored). */
export function field(scope: Scope, label: string): Locator {
  const plain = xpathLiteral(label);
  const required = xpathLiteral(`${label} *`);
  return scope.locator(`xpath=.//*[label[normalize-space(.)=${plain} or normalize-space(.)=${required}]]`);
}

/** The text input or textarea of a field. */
export function input(scope: Scope, label: string): Locator {
  return field(scope, label).locator('input:not([tabindex="-1"]), textarea').first();
}

/** The trigger button of a field's dropdown or date picker. */
export function trigger(scope: Scope, label: string): Locator {
  return field(scope, label).locator('[data-slot="popover-trigger"]').first();
}

/** The popover that is open right now. */
export function openPopover(page: Page): Locator {
  return page.locator('[data-slot="popover-content"][data-open]').last();
}

/**
 * Picks an option in a field's searchable dropdown. `search` types into the dropdown's own search box
 * first (API-backed lists show only a few rows, so search for anything that isn't among the first).
 */
export async function choose(scope: Scope, label: string, option: string, search?: string): Promise<void> {
  await chooseIn(trigger(scope, label), option, search);
}

/** Same as choose(), from the dropdown's trigger button. */
export async function chooseIn(triggerButton: Locator, option: string, search?: string): Promise<void> {
  const page = pageOf(triggerButton);
  await triggerButton.click();
  const popover = openPopover(page);
  if (search !== undefined) await popover.getByPlaceholder("Search", { exact: true }).fill(search);
  await popover.getByRole("button", { name: option, exact: true }).click();
  await expect(popover).toBeHidden();
}

/** Picks a calendar day (yyyy-MM-dd) in a field's date picker. */
export async function pickDate(scope: Scope, label: string, day: string): Promise<void> {
  await pickDateIn(trigger(scope, label), day);
}

/** Same as pickDate(), from the date picker's trigger button. */
export async function pickDateIn(triggerButton: Locator, day: string): Promise<void> {
  const page = pageOf(triggerButton);
  await triggerButton.click();
  await pickInCalendar(openPopover(page), day);
}

/** Moves a calendar to the month of `day` and clicks the day. */
export async function pickInCalendar(calendar: Locator, day: string): Promise<void> {
  const target = calendar.locator(`button[data-day="${pickerDayKey(day)}"]`);
  const [year, month] = day.split("-").map(Number);
  for (let i = 0; i < 36 && (await target.count()) === 0; i++) {
    // The month grid is labelled with the month it shows, e.g. "September 2026".
    const caption = (await calendar.getByRole("grid").first().getAttribute("aria-label")) ?? "";
    const shown = new Date(`${caption.trim()} 1`);
    const later = year * 12 + month > shown.getFullYear() * 12 + shown.getMonth() + 1;
    await calendar.getByRole("button", { name: later ? /next month/i : /previous month/i }).click();
  }
  await target.first().click();
}

/** Fills the day, month and year boxes of a date-of-birth style input (yyyy-MM-dd). */
export async function typeDate(scope: Scope, label: string, day: string): Promise<void> {
  const [y, m, d] = day.split("-");
  const box = field(scope, label);
  await box.getByPlaceholder("DD", { exact: true }).fill(d);
  await box.getByPlaceholder("MM", { exact: true }).fill(m);
  await box.getByPlaceholder("YYYY", { exact: true }).fill(y);
}

/** A modal dialog by its title. */
export function dialog(page: Page, title: string | RegExp): Locator {
  return page.getByRole("dialog", { name: title, exact: typeof title === "string" });
}

/** A confirmation dialog by its title. */
export function alertDialog(page: Page, title: string | RegExp): Locator {
  return page.getByRole("alertdialog", { name: title, exact: typeof title === "string" });
}

/** Answers a confirmation dialog with one of its buttons. */
export async function confirm(page: Page, title: string | RegExp, answer: string): Promise<void> {
  const box = alertDialog(page, title);
  await box.getByRole("button", { name: answer, exact: true }).click();
  await expect(box).toBeHidden();
}

/** A toast by (part of) its text. */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: text });
}

export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(toast(page, text).first()).toBeVisible();
}

/** A card by its title (the nearest card around that title). */
export function card(scope: Scope, title: string | RegExp): Locator {
  const name = typeof title === "string" ? exactText(title) : title;
  return scope
    .locator('[data-slot="card-title"]')
    .filter({ hasText: name })
    .first()
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
}

/** The unnamed "+" button in a card's header (the first button there). */
export function cardAddButton(scope: Locator): Locator {
  return scope.locator('[data-slot="card-header"]').first().getByRole("button").first();
}

/** Table rows (header row excluded) containing `text`. */
export function rows(scope: Scope, text?: string | RegExp): Locator {
  const body = scope.locator('[data-slot="table-body"] > [data-slot="table-row"]');
  return text === undefined ? body : body.filter({ hasText: text });
}

/**
 * Opens a row's "Row actions" menu and clicks one of its items. A list that reloads under the open
 * menu (after a save, say) takes the menu with it, so the menu is opened again then.
 */
export async function rowAction(row: Locator, item: string): Promise<void> {
  const entry = pageOf(row).getByRole("menuitem", { name: item, exact: true });
  await expect(async () => {
    if (!(await entry.isVisible())) await row.getByRole("button", { name: "Row actions" }).click();
    await entry.click({ timeout: 3_000 });
  }).toPass();
}

/** Opens a menu by its trigger's name and clicks one of its items. */
export async function menuItem(scope: Scope, triggerName: string, item: string): Promise<void> {
  await scope.getByRole("button", { name: triggerName, exact: true }).click();
  await pageOf(scope).getByRole("menuitem", { name: item, exact: true }).click();
}

/** A read-only detail field (label above value) by its label. */
export function detail(scope: Scope, label: string): Locator {
  return scope.locator(`xpath=.//*[span[normalize-space(.)=${xpathLiteral(label)}]]`).first();
}

/** The search box of a list card. */
function listSearch(scope: Locator): Locator {
  return scope.locator('[data-slot="card-header"]').getByPlaceholder("Search...", { exact: true });
}

/**
 * Searches a list card and waits for the list to reload with that filter. The list searches on the
 * server a moment after the last keystroke and shows a spinner meanwhile, so rows (and any menu
 * opened on one) found before that reload would go away.
 */
export async function searchList(scope: Locator, text: string): Promise<void> {
  await Promise.all([
    pageOf(scope).waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).searchParams.get("filter") === text),
    listSearch(scope).fill(text),
  ]);
}
