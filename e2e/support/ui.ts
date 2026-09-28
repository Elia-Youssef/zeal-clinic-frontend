import { expect, type Locator, type Page } from "@playwright/test";
import { pickerDayKey } from "./time";

// Page-object helpers. Form labels are linked to their controls, so inputs and dropdown or date
// triggers are found by their label (getByLabel), limited to the kind of control each helper is for,
// and a date input made of several boxes by the group its label names (dateGroup); field() still
// gives a field's wrapper, for the other inputs made of several controls and for whatever sits next
// to the control.

type Scope = Page | Locator;

/** What opens a popup: the control to click, or the steps that open it (a menu pick, a key press). */
type Opener = Locator | (() => Promise<unknown>);

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

/** A field label's text, with or without the " *" of a required field. */
function labelText(label: string): RegExp {
  return new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: \\*)?\\s*$`);
}

/** The text input or textarea of a field (the first one in the scope with that label). */
export function input(scope: Scope, label: string): Locator {
  return scope.getByLabel(labelText(label)).and(scope.locator("input, textarea")).first();
}

/** The trigger button of a field's dropdown or date picker (the first one in the scope with that label). */
export function trigger(scope: Scope, label: string): Locator {
  return scope.getByLabel(labelText(label)).and(scope.locator('[data-slot="popover-trigger"]')).first();
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

/** Moves a calendar to the month of `day`, however many months away, and clicks the day. */
export async function pickInCalendar(calendar: Locator, day: string): Promise<void> {
  const [year, month] = day.split("-").map(Number);
  // The month grid is labelled with the month it shows, e.g. "September 2026".
  const caption = (await calendar.getByRole("grid").first().getAttribute("aria-label")) ?? "";
  const shown = new Date(`${caption.trim()} 1`);
  const months = year * 12 + month - (shown.getFullYear() * 12 + shown.getMonth() + 1);
  const step = calendar.getByRole("button", { name: months > 0 ? /next month/i : /previous month/i });
  for (let i = 0; i < Math.abs(months); i++) await step.click();
  await calendar.locator(`button[data-day="${pickerDayKey(day)}"]`).first().click();
}

/** A date-of-birth style input: the group of day, month and year boxes that its field label names. */
export function dateGroup(scope: Scope, label: string): Locator {
  return scope.getByRole("group", { name: labelText(label) });
}

/** Fills the day, month and year boxes of a date-of-birth style input (yyyy-MM-dd). */
export async function typeDate(scope: Scope, label: string, day: string): Promise<void> {
  const [y, m, d] = day.split("-");
  const group = dateGroup(scope, label);
  await group.getByRole("textbox", { name: "Day", exact: true }).fill(d);
  await group.getByRole("textbox", { name: "Month", exact: true }).fill(m);
  await group.getByRole("textbox", { name: "Year", exact: true }).fill(y);
}

/**
 * Opens a popup (a dialog, popover or menu) with `opener` and returns `popup` once it is ready for input.
 *
 * Base UI moves a freshly opened popup's focus to its first control (or to the popup itself, when nothing
 * inside is tabbable or it opened by touch) one animation frame after it opens. A step in that frame can
 * lose to it: fill focuses its own field and then types in a separate step, and a focus() followed by a
 * key press can see the focus move in between. Once focus is inside the popup, that first focus is done
 * and nothing moves focus again, so the popup is ready. A popup opened with `initialFocus={false}`
 * (SearchableDropdown's list) never takes focus, so it must not be opened with this.
 */
export async function opened(popup: Locator, opener: Opener): Promise<Locator> {
  if (typeof opener === "function") await opener();
  else await opener.click();
  await expect(popup.and(popup.page().locator(":focus-within"))).toBeVisible();
  return popup;
}

/** A modal dialog by its title, one that is open already or should be gone (openDialog() opens one). */
export function dialog(page: Page, title: string | RegExp): Locator {
  return page.getByRole("dialog", { name: title, exact: typeof title === "string" });
}

/** Opens a modal dialog and returns it once its first focus has landed (see opened()). */
export async function openDialog(page: Page, title: string | RegExp, opener: Opener): Promise<Locator> {
  return opened(dialog(page, title), opener);
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

/** The "+" button in a card's header (the first button there). */
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
