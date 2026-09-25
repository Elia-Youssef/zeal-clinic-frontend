import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { readActions, readSidebar, readTabs, readTitle, settle } from "../support/app";
import type { Role } from "../support/demo-credentials";
import { albumDir, isUpdateMode, partsDir } from "../support/env";
import { expect, test } from "../support/fixtures";
import { diffEntry, loadRouteAccess, writePart, type WalkEntry } from "../support/golden";
import { errorScreen } from "../support/guards";
import { APP_ROUTES, fillPath, matchRoute, routeSlug, tabPaths, type AppRoute } from "../support/routes";

async function describePage(page: Page, route: AppRoute): Promise<Omit<WalkEntry, "result">> {
  const title = await readTitle(page);
  const tabs = route.tabs ? await readTabs(page, tabPaths(route)) : undefined;
  const actions = await readActions(page);
  return { title, tabs, ...(actions.length ? { actions } : {}) };
}

/**
 * Opens every route of src/App.tsx as `role` and records where it ends up, the header title, the
 * visible tabs, the page's New/Edit/Delete buttons and the sidebar, against e2e/golden/route-access.json.
 */
export function defineRouteWalk(role: Role): void {
  test.describe(`${role} route walk`, () => {
    test.use({ role });

    APP_ROUTES.forEach((route, index) => {
      test(route.path, async ({ page, guards, runtime }, testInfo) => {
        const target = fillPath(route, runtime.params);
        await page.goto(target, { waitUntil: "domcontentloaded" });
        await settle(page, guards);
        await expect(errorScreen(page), "the error screen is showing").toHaveCount(0);

        const landed = new URL(page.url()).pathname;
        const rendered = landed === target;
        const entry: WalkEntry = rendered
          ? { result: "rendered", ...(await describePage(page, route)) }
          : { result: `redirect → ${matchRoute(landed)}` };
        const sidebar = rendered && route.path !== "/" ? await readSidebar(page) : null;

        const album = albumDir();
        if (album) {
          const file = path.join(album, role, `${String(index).padStart(2, "0")}-${routeSlug(route.path)}.png`);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          await page.screenshot({ path: file, fullPage: true });
        }

        writePart(partsDir(testInfo.project.outputDir), "walk", `${role}--${routeSlug(route.path)}`, {
          role,
          route: route.path,
          entry,
          sidebar,
          calls: guards.calls,
        });
        if (isUpdateMode(testInfo.config.updateSnapshots)) return;

        const golden = loadRouteAccess();
        expect(golden, "e2e/golden/route-access.json is missing: record it with E2E_UPDATE_GOLDENS=1").not.toBeNull();
        const expected = golden?.routes[route.path]?.[role];
        const differences = diffEntry(expected, entry, ["result", "title", "tabs", "actions"]);
        if (rendered && expected) {
          // Every 403 the golden lists for this page must still happen (the guards reject unlisted ones).
          const seen = guards.forbiddenOn(route.path);
          const gone = (expected.forbidden ?? []).filter((call) => !seen.includes(call));
          if (gone.length) differences.push(`forbidden: no longer seen ${JSON.stringify(gone)}`);
        }
        const expectedSidebar = golden?.sidebar[role];
        if (sidebar && JSON.stringify(sidebar) !== JSON.stringify(expectedSidebar ?? null)) {
          differences.push(`sidebar: expected ${JSON.stringify(expectedSidebar ?? null)}, got ${JSON.stringify(sidebar)}`);
        }
        expect(differences, `${role} ${route.path} differs from route-access.json`).toEqual([]);
      });
    });
  });
}
