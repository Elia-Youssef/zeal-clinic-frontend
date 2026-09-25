import path from "node:path";
import type { FullConfig } from "@playwright/test";
import type { Session } from "./api";
import type { Role } from "./demo-credentials";
import type { StackState } from "./stack";

// Settings come from the environment; the e2e stage of scripts/ci.ps1 sets them.
//   BACKEND_DIR          backend checkout whose scripts/stack.ps1 builds and runs the server (required)
//   E2E_INSTANCE         demo (default): demo data and the smoke project; scenario: migrations only and
//                        the flows, serial, mobile, dark and tz-foreign projects
//   E2E_ARTIFACTS_DIR    reports, traces, server logs (default: test-results/)
//   E2E_ALBUM_DIR        screenshot album of the walked pages; nothing is saved when unset
//   E2E_UPDATE_GOLDENS   1 = record today's behavior into e2e/golden/ (same as --update-snapshots)
//   E2E_GREP             run only the tests whose project, file or title matches this pattern
//   E2E_PORT             server port (default 55580)
//   E2E_STACK_WORK_DIR   stack.ps1 -WorkDir (default: its own, "nodes" next to the backend checkout)
//   E2E_STACK_BIN_DIR    stack.ps1 -BinDir; a fixed folder keeps one binary path across runs
//   E2E_PWSH             PowerShell 7 executable (default: pwsh)

export const repoRoot = path.resolve(import.meta.dirname, "..", "..");
export const goldenDir = path.join(repoRoot, "e2e", "golden");

export const port = Number(process.env.E2E_PORT || 55580);
export const baseURL = `http://127.0.0.1:${port}`;

export type Instance = "demo" | "scenario";

export function instanceKind(): Instance {
  return process.env.E2E_INSTANCE === "scenario" ? "scenario" : "demo";
}

export function artifactsDir(): string {
  return path.resolve(process.env.E2E_ARTIFACTS_DIR || path.join(repoRoot, "test-results"));
}

export function albumDir(): string | null {
  const dir = process.env.E2E_ALBUM_DIR;
  return dir ? path.resolve(dir) : null;
}

export function backendDir(): string {
  const dir = process.env.BACKEND_DIR;
  if (!dir) throw new Error("BACKEND_DIR is not set: point it at a checkout of the backend repo");
  return path.resolve(dir);
}

type UpdateSetting = FullConfig["updateSnapshots"];

/** Goldens are rewritten from this run instead of compared. */
export function isUpdateMode(updateSnapshots: UpdateSetting): boolean {
  return process.env.E2E_UPDATE_GOLDENS === "1" || updateSnapshots === "all" || updateSnapshots === "changed";
}

/** Where tests leave their recorded observations for the global teardown. */
export function partsDir(outputDir: string): string {
  return path.join(outputDir, "golden-parts");
}

/** What the global setup hands to the workers. */
export type Runtime = {
  instance: Instance;
  baseURL: string;
  /** Username per role: looked up on the demo instance, created on the scenario instance. */
  users: Record<Role, string>;
  /** Password per role; the super-admin's is the throwaway one its first sign-in set. */
  passwords: Record<Role, string>;
  /** One sign-in per role for the whole run (sign-ins are rate limited); tests that sign out use their own. */
  sessions: Record<Role, Session>;
  /** Real values for the routes with a parameter, keyed by route path (demo instance only). */
  params: Record<string, string>;
  stack: StackState;
};

const RUNTIME_VAR = "E2E_RUNTIME";

export function setRuntime(runtime: Runtime): void {
  process.env[RUNTIME_VAR] = JSON.stringify(runtime);
}

export function readRuntime(): Runtime {
  const raw = process.env[RUNTIME_VAR];
  if (!raw) throw new Error(`${RUNTIME_VAR} is not set: the global setup did not run`);
  return JSON.parse(raw) as Runtime;
}

export function tryReadRuntime(): Runtime | null {
  return process.env[RUNTIME_VAR] ? readRuntime() : null;
}
