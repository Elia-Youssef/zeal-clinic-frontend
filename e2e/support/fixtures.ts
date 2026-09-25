import { test as base, type BrowserContext, type Page } from "@playwright/test";
import { apiLogin, apiLogout, sessionEntries, type Session } from "./api";
import type { Role } from "./demo-credentials";
import { isUpdateMode, partsDir, readRuntime, type Runtime } from "./env";
import { loadConsoleAllowlist, loadRouteAccess, writePart } from "./golden";
import { Guards } from "./guards";
import { Scenario } from "./scenario";

export { expect } from "@playwright/test";

// Runs in the browser before any page script: writes the session the way a sign-in does, once per
// tab, so a later sign-out or expired session behaves as it would for a user.
function seedSession(seed: { origin: string; entries: [string, string][] }) {
  if (window.top !== window || location.origin !== seed.origin) return;
  const marker = "e2e-session-seeded";
  if (window.name === marker) return;
  window.name = marker;
  for (const [key, value] of seed.entries) sessionStorage.setItem(key, value);
}

/** Makes every new tab of `context` start signed in as `session`. */
export async function seedContext(context: BrowserContext, origin: string, session: Session): Promise<void> {
  await context.addInitScript(seedSession, { origin, entries: sessionEntries(session) });
}

type TestFixtures = {
  /** The role the test signs in as; null runs signed out. */
  role: Role | null;
  /** Sign the role in for this test alone, for tests that sign out or revoke the session. */
  ownSession: boolean;
  session: Session | null;
  guards: Guards;
  /** Opens a tab in a new browser context, signed in as `session` (signed out with null) and guarded. */
  openPage: (session: Session | null) => Promise<Page>;
  /** Builds data through the API (scenario instance). */
  scenario: Scenario;
};

type WorkerFixtures = {
  runtime: Runtime;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  role: [null, { option: true }],
  ownSession: [false, { option: true }],

  // eslint-disable-next-line no-empty-pattern
  runtime: [async ({}, provide) => provide(readRuntime()), { scope: "worker" }],

  session: async ({ role, ownSession, runtime }, provide) => {
    if (!role) return provide(null);
    if (!ownSession) return provide(runtime.sessions[role]);
    const session = await apiLogin(runtime.baseURL, runtime.users[role], runtime.passwords[role]);
    await provide(session);
    await apiLogout(runtime.baseURL, session.token);
  },

  context: async ({ context, session, runtime }, provide) => {
    if (session) await seedContext(context, new URL(runtime.baseURL).origin, session);
    await provide(context);
  },

  guards: [
    async ({ page, role, runtime }, provide, testInfo) => {
      const guards = new Guards({
        role,
        project: testInfo.project.name,
        origin: new URL(runtime.baseURL).origin,
        update: isUpdateMode(testInfo.config.updateSnapshots),
        golden: loadRouteAccess(),
        allowlist: loadConsoleAllowlist(),
      });
      guards.watch(page);
      page.context().on("page", (other) => guards.watch(other));
      await provide(guards);
      const part = await guards.finish();
      writePart(partsDir(testInfo.project.outputDir), "guard", testInfo.testId, part);
      const report = guards.problemReport();
      if (report) throw new Error(report);
    },
    { auto: true },
  ],

  openPage: async ({ browser, runtime, guards }, provide) => {
    const contexts: BrowserContext[] = [];
    await provide(async (session) => {
      const context = await browser.newContext();
      contexts.push(context);
      if (session) await seedContext(context, new URL(runtime.baseURL).origin, session);
      context.on("page", (page) => guards.watch(page, (session?.role as Role | undefined) ?? null));
      return context.newPage();
    });
    await guards.inspectPages();
    for (const context of contexts) await context.close();
  },

  scenario: async ({ runtime }, provide, testInfo) => {
    await provide(new Scenario(runtime, testInfo.workerIndex));
  },
});
