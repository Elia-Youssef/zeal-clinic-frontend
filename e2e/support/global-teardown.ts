import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { ROLES } from "./demo-credentials";
import { artifactsDir, isUpdateMode, partsDir, tryReadRuntime } from "./env";
import {
  buildConsoleAllowlist,
  buildRouteAccess,
  CONSOLE_ALLOWLIST_FILE,
  diffRouteAccess,
  formatConsoleAllowlist,
  formatRouteAccess,
  loadConsoleAllowlist,
  loadRouteAccess,
  readParts,
  ROUTE_ACCESS_FILE,
  type GuardPart,
  type WalkPart,
} from "./golden";
import { APP_ROUTES } from "./routes";
import { stopStack } from "./stack";

const WALK_PROJECT = "smoke";

/** Assembles the goldens from what the walk recorded: rewrites them in update mode, else saves the actual copies. */
function finishGoldens(config: FullConfig, notes: string[]): string[] {
  const project = config.projects.find((p) => p.name === WALK_PROJECT);
  if (!project) return [];
  const dir = partsDir(project.outputDir);
  const walk = readParts<WalkPart>(dir, "walk");
  if (!walk.length) return [];
  const guard = readParts<GuardPart>(dir, "guard").filter((p) => p.project === WALK_PROJECT);
  const errors: string[] = [];
  const expectedPages = ROLES.length * APP_ROUTES.length;
  const { golden, problems } = buildRouteAccess(walk, guard);
  const allowlist = buildConsoleAllowlist(loadConsoleAllowlist(), guard, WALK_PROJECT);
  const out = artifactsDir();
  fs.writeFileSync(path.join(out, "route-access.actual.json"), formatRouteAccess(golden));
  fs.writeFileSync(path.join(out, "console-allowlist.actual.json"), formatConsoleAllowlist(allowlist));
  errors.push(...problems);

  const complete = walk.length === expectedPages;
  if (isUpdateMode(config.updateSnapshots)) {
    if (!complete) {
      errors.push(`goldens not updated: the walk covered ${walk.length} of ${expectedPages} pages`);
    } else if (!problems.length) {
      fs.mkdirSync(path.dirname(ROUTE_ACCESS_FILE), { recursive: true });
      fs.writeFileSync(ROUTE_ACCESS_FILE, formatRouteAccess(golden));
      fs.writeFileSync(CONSOLE_ALLOWLIST_FILE, formatConsoleAllowlist(allowlist));
      notes.push(`goldens: written (${walk.length} pages, ${allowlist.errors.length} allowed console errors)`);
    }
    return errors;
  }
  const expected = loadRouteAccess();
  if (!complete) {
    notes.push(`goldens: partial walk (${walk.length} of ${expectedPages} pages), not compared as a whole`);
  } else if (!expected) {
    notes.push("goldens: route-access.json is missing");
  } else {
    const diff = diffRouteAccess(expected, golden);
    fs.writeFileSync(path.join(out, "golden-diff.txt"), diff.length ? diff.join("\n") + "\n" : "no differences\n");
    notes.push(diff.length ? `goldens: ${diff.length} difference(s), see golden-diff.txt` : "goldens: match");
  }
  return errors;
}

export default async function globalTeardown(config: FullConfig): Promise<void> {
  const errors: string[] = [];
  const notes: string[] = [];
  try {
    errors.push(...finishGoldens(config, notes));
  } catch (error) {
    errors.push(`goldens: ${(error as Error).message}`);
  }

  const runtime = tryReadRuntime();
  if (runtime) {
    const stackDir = path.join(artifactsDir(), "stack");
    const stop = await stopStack(runtime.stack, path.join(stackDir, "stop.log"));
    notes.push(`server: stopped (${stop.method}${stop.graceful ? ", graceful" : ", NOT graceful"}${stop.note ? `, ${stop.note}` : ""})`);
    if (!stop.graceful) errors.push(`the server did not stop gracefully (${stop.method}${stop.note ? `: ${stop.note}` : ""})`);
    const logs = [runtime.stack.log, runtime.stack.console, path.join(runtime.stack.dataRoot, "seed-console.log")];
    for (const file of logs) {
      if (fs.existsSync(file)) fs.copyFileSync(file, path.join(stackDir, path.basename(file)));
    }
  }

  const summary = [...notes, ...errors.map((e) => `error: ${e}`)];
  fs.mkdirSync(artifactsDir(), { recursive: true });
  fs.writeFileSync(path.join(artifactsDir(), "harness-summary.txt"), summary.join("\n") + "\n");
  for (const line of summary) console.log(`[e2e] ${line}`);
  if (errors.length) throw new Error(errors.join("\n"));
}
