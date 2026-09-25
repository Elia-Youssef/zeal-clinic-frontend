import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { apiGet, apiLogin, apiRequest, listItems, throwawayPassword, type Session } from "./api";
import { DEMO_PASSWORD, ROLES, SUPER_ADMIN_USERNAME, type Role } from "./demo-credentials";
import { artifactsDir, backendDir, baseURL, instanceKind, port, repoRoot, setRuntime } from "./env";
import { APP_ROUTES } from "./routes";
import { startStack, stopStack } from "./stack";

type UserRow = { id: string; username: string; role: string; isActive: boolean };
type Row = { id?: string; name?: string };

/** The accounts the scenario instance gets for the three assignable roles. */
const SCENARIO_ACCOUNTS: Record<Exclude<Role, "super-admin">, { username: string; displayName: string }> = {
  admin: { username: "e2e-admin", displayName: "E2E Admin" },
  staff: { username: "e2e-staff", displayName: "E2E Staff" },
  nurse: { username: "e2e-nurse", displayName: "E2E Nurse" },
};

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

/** The first active account of each role (by username) on the demo instance. */
async function findRoleUsers(url: string, token: string): Promise<Record<Role, string>> {
  const users = listItems(await apiGet<{ items: UserRow[] }>(url, token, "/users?limit=100"));
  const found = { "super-admin": SUPER_ADMIN_USERNAME } as Record<Role, string>;
  for (const role of ROLES) {
    if (role === "super-admin") continue;
    const match = users
      .filter((u) => u.role === role && u.isActive)
      .map((u) => u.username)
      .sort()[0];
    if (!match) throw new Error(`the demo data has no active ${role} account`);
    found[role] = match;
  }
  return found;
}

/** A real value for each route parameter: the smallest id (or name) the list returns. */
async function resolveRouteParams(url: string, token: string): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  for (const route of APP_ROUTES) {
    if (!route.param) continue;
    const { list, key } = route.param;
    const separator = list.includes("?") ? "&" : "?";
    const rows = listItems(await apiGet<{ items: Row[] } | Row[]>(url, token, `${list}${separator}limit=100`));
    const values = rows.map((r) => r[key]).filter((v): v is string => typeof v === "string" && v !== "").sort();
    if (!values.length) throw new Error(`GET /api${list} returned nothing to open ${route.path} with`);
    params[route.path] = values[0];
  }
  return params;
}

type Accounts = { users: Record<Role, string>; passwords: Record<Role, string> };

async function demoAccounts(url: string, superAdmin: Session, superAdminPassword: string): Promise<Accounts> {
  const users = await findRoleUsers(url, superAdmin.token);
  const passwords = { "super-admin": superAdminPassword } as Record<Role, string>;
  for (const role of ROLES) if (role !== "super-admin") passwords[role] = DEMO_PASSWORD;
  return { users, passwords };
}

/** Creates one account per assignable role through the API, each with a throwaway password. */
async function scenarioAccounts(url: string, superAdmin: Session, superAdminPassword: string): Promise<Accounts> {
  const users = { "super-admin": SUPER_ADMIN_USERNAME } as Record<Role, string>;
  const passwords = { "super-admin": superAdminPassword } as Record<Role, string>;
  for (const [role, account] of Object.entries(SCENARIO_ACCOUNTS) as [Exclude<Role, "super-admin">, { username: string; displayName: string }][]) {
    const password = throwawayPassword();
    await apiRequest(url, superAdmin.token, "POST", "/users", { ...account, role, password });
    users[role] = account.username;
    passwords[role] = password;
  }
  return { users, passwords };
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const instance = instanceKind();
  const backend = backendDir();
  const distDir = path.join(repoRoot, "dist");
  if (!fs.existsSync(path.join(distDir, "index.html"))) {
    throw new Error(`${distDir} has no index.html: build the dashboard first (npm run build)`);
  }
  const stackDir = path.join(artifactsDir(), "stack");
  fs.mkdirSync(stackDir, { recursive: true });
  const workDir = path.resolve(process.env.E2E_STACK_WORK_DIR || path.join(path.dirname(backend), "nodes"));
  const binDir = path.resolve(process.env.E2E_STACK_BIN_DIR || path.join(workDir, "bin"));

  const stack = await startStack({
    backendDir: backend,
    port,
    demo: instance === "demo",
    distDir,
    workDir,
    binDir,
    // A fresh data folder per run: the super-admin's first sign-in below must meet a new database.
    dataRoot: path.join(workDir, `e2e-${instance}-${port}-${timestamp()}`),
    logFile: path.join(stackDir, "start.log"),
  });
  fs.writeFileSync(path.join(stackDir, "state.json"), JSON.stringify(stack, null, 2) + "\n");

  try {
    if (stack.url !== baseURL) throw new Error(`the server runs at ${stack.url}, the tests expect ${baseURL}`);
    // Today's behavior: the first sign-in of the passwordless super-admin sets its password.
    const superAdminPassword = throwawayPassword();
    const superAdmin = await apiLogin(stack.url, SUPER_ADMIN_USERNAME, superAdminPassword);
    const accounts =
      instance === "demo"
        ? await demoAccounts(stack.url, superAdmin, superAdminPassword)
        : await scenarioAccounts(stack.url, superAdmin, superAdminPassword);
    const sessions = { "super-admin": superAdmin } as Record<Role, Session>;
    for (const role of ROLES) {
      if (role !== "super-admin") sessions[role] = await apiLogin(stack.url, accounts.users[role], accounts.passwords[role]);
    }
    const params = instance === "demo" ? await resolveRouteParams(stack.url, superAdmin.token) : {};
    setRuntime({ instance, baseURL: stack.url, ...accounts, sessions, params, stack });
    console.log(`[e2e] ${instance} instance ready at ${stack.url} (${config.projects.map((p) => p.name).join(", ")})`);
  } catch (error) {
    await stopStack(stack, path.join(stackDir, "stop.log")).catch(() => undefined);
    throw error;
  }
}
