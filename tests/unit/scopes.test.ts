import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_SCOPES, scopeMatrix } from "@/lib/scopes";

const SRC_DIR = fileURLToPath(new URL("../../src", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("ALL_SCOPES", () => {
  it("lists 82 unique resource:action scopes", () => {
    expect(ALL_SCOPES).toHaveLength(82);
    expect(new Set(ALL_SCOPES).size).toBe(82);
    for (const scope of ALL_SCOPES) {
      expect(scope).toMatch(/^[a-z]+(-[a-z]+)*:(read|write|delete)$/);
    }
  });

  it("contains every scope string the UI checks", () => {
    const known = new Set<string>(ALL_SCOPES);
    const literal = /["'`]([a-z][a-z-]*:(?:read|write|delete))["'`]/g;
    const used = new Map<string, string>();
    for (const file of sourceFiles(SRC_DIR)) {
      const name = relative(SRC_DIR, file).replace(/\\/g, "/");
      if (name === "lib/scopes.ts") continue;
      for (const match of readFileSync(file, "utf8").matchAll(literal)) {
        if (!used.has(match[1])) used.set(match[1], name);
      }
    }
    const unknown = [...used].filter(([scope]) => !known.has(scope));
    expect(unknown).toEqual([]);
    // Guards the scan itself: the UI checks most of the scopes.
    expect(used.size).toBeGreaterThan(60);
  });
});

describe("scopeMatrix", () => {
  it("groups ALL_SCOPES into role-editor rows in first-seen order", () => {
    expect(scopeMatrix(ALL_SCOPES)).toEqual([
      { resource: "allergies", actions: ["read", "write", "delete"] },
      { resource: "analytics", actions: ["read"] },
      { resource: "appointments", actions: ["read", "write", "delete"] },
      { resource: "audit", actions: ["read"] },
      { resource: "balances", actions: ["read"] },
      { resource: "cloud-restore", actions: ["write"] },
      { resource: "currencies", actions: ["read", "write", "delete"] },
      { resource: "discounts", actions: ["read", "write", "delete"] },
      { resource: "employees", actions: ["read", "write", "delete"] },
      { resource: "employee-payments", actions: ["read", "write", "delete"] },
      { resource: "employee-salaries", actions: ["read", "write", "delete"] },
      { resource: "employee-schedules", actions: ["write", "delete"] },
      { resource: "expenses", actions: ["read", "write", "delete"] },
      { resource: "hr", actions: ["read", "write", "delete"] },
      { resource: "invoices", actions: ["read", "write", "delete"] },
      { resource: "medicines", actions: ["read", "write", "delete"] },
      { resource: "patients", actions: ["read", "write", "delete"] },
      { resource: "patient-allergies", actions: ["read", "write"] },
      { resource: "patient-medicines", actions: ["read", "write"] },
      { resource: "payments", actions: ["read", "write", "delete"] },
      { resource: "prescriptions", actions: ["read", "write", "delete"] },
      { resource: "procedures", actions: ["read", "write", "delete"] },
      { resource: "procedure-categories", actions: ["read", "write"] },
      { resource: "procedure-types", actions: ["read", "write"] },
      { resource: "procedure-allergy-conflicts", actions: ["read", "write"] },
      { resource: "products", actions: ["read", "write", "delete"] },
      { resource: "product-categories", actions: ["read", "write", "delete"] },
      { resource: "product-allergy-conflicts", actions: ["read", "write"] },
      { resource: "reports", actions: ["read"] },
      { resource: "roles", actions: ["read", "write"] },
      { resource: "rooms", actions: ["read", "write", "delete"] },
      { resource: "suppliers", actions: ["read", "write", "delete"] },
      { resource: "update", actions: ["read", "write"] },
      { resource: "users", actions: ["read", "write"] },
    ]);
  });

  it("orders actions read, write, delete whatever the input order", () => {
    expect(scopeMatrix(["rooms:delete", "rooms:read", "rooms:delete"])).toEqual([
      { resource: "rooms", actions: ["read", "delete"] },
    ]);
  });

  it("splits on the last colon, skips entries without one and drops unknown actions", () => {
    expect(scopeMatrix(["reports", "a:b:read", "rooms:admin"])).toEqual([
      { resource: "a:b", actions: ["read"] },
      { resource: "rooms", actions: [] },
    ]);
  });

  it("returns no rows for no scopes", () => {
    expect(scopeMatrix([])).toEqual([]);
  });
});
