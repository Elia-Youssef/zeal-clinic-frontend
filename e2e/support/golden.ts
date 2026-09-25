import fs from "node:fs";
import path from "node:path";
import { ROLES, type Role } from "./demo-credentials";
import { goldenDir } from "./env";
import { APP_ROUTES } from "./routes";

/** What one role sees at one route. */
export type WalkEntry = {
  /** "rendered", or "redirect → <route>" where the page ended up. */
  result: string;
  /** The header title. */
  title?: string;
  /** The visible tabs of the page's tabs layout. */
  tabs?: string[];
  /** Visible "New", "Edit" and "Delete" buttons in the page content. */
  actions?: string[];
  /** API calls that answer 403 on this page today; the guards allow exactly these. */
  forbidden?: string[];
};

export type RouteAccess = {
  /** Visible sidebar entries per role ("Group: Item"). */
  sidebar: Partial<Record<Role, string[]>>;
  routes: Record<string, Partial<Record<Role, WalkEntry>>>;
};

export type ConsoleEntry = { text: string; url?: string };
export type AllowedConsoleError = ConsoleEntry & { projects: string[] };
export type ConsoleAllowlist = { errors: AllowedConsoleError[] };

export const ROUTE_ACCESS_FILE = path.join(goldenDir, "route-access.json");
export const CONSOLE_ALLOWLIST_FILE = path.join(goldenDir, "console-allowlist.json");

/** Observations a walk test leaves for the global teardown. */
export type WalkPart = { role: Role; route: string; entry: WalkEntry; sidebar: string[] | null; calls: string[] };
/** Observations the guards leave for every test. */
export type GuardPart = {
  project: string;
  role: Role | null;
  forbidden: Record<string, string[]>;
  console: ConsoleEntry[];
};

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

let routeAccessCache: RouteAccess | null | undefined;
let allowlistCache: ConsoleAllowlist | undefined;

export function loadRouteAccess(): RouteAccess | null {
  if (routeAccessCache === undefined) routeAccessCache = readJson<RouteAccess>(ROUTE_ACCESS_FILE);
  return routeAccessCache;
}

export function loadConsoleAllowlist(): ConsoleAllowlist {
  if (allowlistCache === undefined) allowlistCache = readJson<ConsoleAllowlist>(CONSOLE_ALLOWLIST_FILE) ?? { errors: [] };
  return allowlistCache;
}

export function writePart(dir: string, kind: "walk" | "guard", name: string, data: WalkPart | GuardPart): void {
  const folder = path.join(dir, kind);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${name}.json`), JSON.stringify(data));
}

export function readParts<T>(dir: string, kind: "walk" | "guard"): T[] {
  const folder = path.join(dir, kind);
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(folder, f), "utf8")) as T);
}

function matches(pattern: string, value: string): boolean {
  if (!pattern.includes("*")) return pattern === value;
  const re = new RegExp(`^${pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "s");
  return re.test(value);
}

/** A console error is allowed when an entry matches its text and URL ("*" is a wildcard). */
export function isAllowedConsoleError(allowlist: ConsoleAllowlist, error: ConsoleEntry): boolean {
  return allowlist.errors.some((e) => matches(e.text, error.text) && matches(e.url ?? "", error.url ?? ""));
}

export function allowedForbidden(golden: RouteAccess | null, role: Role | null, route: string): string[] {
  if (!golden || !role) return [];
  return golden.routes[route]?.[role]?.forbidden ?? [];
}

const oneLine = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(oneLine).join(", ")}]`;
  if (value && typeof value === "object") {
    const fields = Object.entries(value).filter(([, v]) => v !== undefined);
    return `{ ${fields.map(([k, v]) => `${JSON.stringify(k)}: ${oneLine(v)}`).join(", ")} }`;
  }
  return JSON.stringify(value);
};

const block = (indent: string, rows: string[]) => rows.map((r, i) => `${indent}${r}${i < rows.length - 1 ? "," : ""}`);

/** Stable text form: one line per role, so a diff shows exactly which page changed for whom. */
export function formatRouteAccess(golden: RouteAccess): string {
  const sidebar = ROLES.filter((r) => golden.sidebar[r]).map((r) => `${JSON.stringify(r)}: ${oneLine(golden.sidebar[r])}`);
  const routes = Object.entries(golden.routes).map(([route, perRole]) => {
    const rows = ROLES.filter((r) => perRole[r]).map((r) => `${JSON.stringify(r)}: ${oneLine(perRole[r])}`);
    return [`${JSON.stringify(route)}: {`, ...block("  ", rows), "}"].join("\n    ");
  });
  return ["{", '  "sidebar": {', ...block("    ", sidebar), "  },", '  "routes": {', ...block("    ", routes), "  }", "}", ""].join("\n");
}

export function formatConsoleAllowlist(allowlist: ConsoleAllowlist): string {
  return ["{", '  "errors": [', ...block("    ", allowlist.errors.map(oneLine)), "  ]", "}", ""].join("\n");
}

const entryFields: (keyof WalkEntry)[] = ["result", "title", "tabs", "actions", "forbidden"];

/** Field-by-field differences between a golden entry and what the page showed. */
export function diffEntry(expected: WalkEntry | undefined, actual: WalkEntry, fields = entryFields): string[] {
  if (!expected) return ["not in the golden"];
  const out: string[] = [];
  for (const field of fields) {
    const e = JSON.stringify(expected[field] ?? null);
    const a = JSON.stringify(actual[field] ?? null);
    if (e !== a) out.push(`${field}: expected ${e}, got ${a}`);
  }
  return out;
}

export function diffRouteAccess(expected: RouteAccess, actual: RouteAccess): string[] {
  const out: string[] = [];
  for (const role of ROLES) {
    const e = JSON.stringify(expected.sidebar[role] ?? null);
    const a = JSON.stringify(actual.sidebar[role] ?? null);
    if (e !== a) out.push(`sidebar ${role}: expected ${e}, got ${a}`);
  }
  const routes = new Set([...Object.keys(expected.routes), ...Object.keys(actual.routes)]);
  for (const route of routes) {
    for (const role of ROLES) {
      const e = expected.routes[route]?.[role];
      const a = actual.routes[route]?.[role];
      if (!e && !a) continue;
      if (!a) {
        out.push(`${role} ${route}: missing from this run`);
        continue;
      }
      for (const d of diffEntry(e, a)) out.push(`${role} ${route}: ${d}`);
    }
  }
  return out;
}

/** The golden as this run saw it. `problems` lists pages whose sidebar differs from the role's dashboard. */
export function buildRouteAccess(walk: WalkPart[], guard: GuardPart[]): { golden: RouteAccess; problems: string[] } {
  const forbidden = new Map<string, Set<string>>();
  for (const part of guard) {
    if (!part.role) continue;
    for (const [route, calls] of Object.entries(part.forbidden)) {
      const key = `${part.role} ${route}`;
      const set = forbidden.get(key) ?? new Set<string>();
      for (const call of calls) set.add(call);
      forbidden.set(key, set);
    }
  }
  const walked = new Map(walk.map((w) => [`${w.role} ${w.route}`, w]));
  const golden: RouteAccess = { sidebar: {}, routes: {} };
  const problems: string[] = [];
  for (const role of ROLES) {
    const home = walked.get(`${role} /dashboard`);
    if (home?.sidebar) golden.sidebar[role] = home.sidebar;
  }
  for (const route of APP_ROUTES) {
    const perRole: Partial<Record<Role, WalkEntry>> = {};
    for (const role of ROLES) {
      const part = walked.get(`${role} ${route.path}`);
      const calls = [...(forbidden.get(`${role} ${route.path}`) ?? [])].sort();
      if (!part && !calls.length) continue;
      const entry: WalkEntry = part ? { ...part.entry } : { result: "not walked" };
      if (calls.length) entry.forbidden = calls;
      perRole[role] = entry;
      const expected = golden.sidebar[role];
      if (part?.sidebar && expected && JSON.stringify(part.sidebar) !== JSON.stringify(expected)) {
        problems.push(`${role} ${route.path}: sidebar ${JSON.stringify(part.sidebar)} differs from the dashboard's`);
      }
    }
    golden.routes[route.path] = perRole;
  }
  return { golden, problems };
}

/** The allowlist with `project`'s entries replaced by what this run saw; other projects' entries stay. */
export function buildConsoleAllowlist(existing: ConsoleAllowlist, guard: GuardPart[], project: string): ConsoleAllowlist {
  const key = (e: ConsoleEntry) => `${e.text}\n${e.url ?? ""}`;
  const merged = new Map<string, AllowedConsoleError>();
  for (const e of existing.errors) {
    const projects = e.projects.filter((p) => p !== project);
    if (projects.length) merged.set(key(e), { ...e, projects });
  }
  for (const part of guard) {
    if (part.project !== project) continue;
    for (const c of part.console) {
      const found = merged.get(key(c));
      if (!found) merged.set(key(c), { text: c.text, ...(c.url ? { url: c.url } : {}), projects: [project] });
      else if (!found.projects.includes(project)) found.projects = [...found.projects, project].sort();
    }
  }
  const errors = [...merged.values()].sort((a, b) => a.text.localeCompare(b.text) || (a.url ?? "").localeCompare(b.url ?? ""));
  return { errors };
}
