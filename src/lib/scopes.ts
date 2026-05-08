/**
 * Canonical list of all backend scopes. Mirrors scopes.json at the project
 * root; keep both in sync when the backend permission set changes.
 */
export const ALL_SCOPES = [
  "allergies:read",
  "allergies:write",
  "allergies:delete",
  "analytics:read",
  "appointments:read",
  "appointments:write",
  "appointments:delete",
  "audit:read",
  "balances:read",
  "currencies:read",
  "currencies:write",
  "currencies:delete",
  "discounts:read",
  "discounts:write",
  "discounts:delete",
  "employees:read",
  "employees:write",
  "employees:delete",
  "employee-payments:read",
  "employee-payments:write",
  "employee-payments:delete",
  "employee-salaries:read",
  "employee-salaries:write",
  "employee-salaries:delete",
  "expenses:read",
  "expenses:write",
  "expenses:delete",
  "hr:read",
  "hr:write",
  "hr:delete",
  "invoices:read",
  "invoices:write",
  "invoices:delete",
  "medicines:read",
  "medicines:write",
  "medicines:delete",
  "patients:read",
  "patients:write",
  "patients:delete",
  "patient-allergies:read",
  "patient-allergies:write",
  "patient-medicines:read",
  "patient-medicines:write",
  "payments:read",
  "payments:write",
  "payments:delete",
  "prescriptions:read",
  "prescriptions:write",
  "prescriptions:delete",
  "procedures:read",
  "procedures:write",
  "procedures:delete",
  "procedure-categories:read",
  "procedure-categories:write",
  "procedure-types:read",
  "procedure-types:write",
  "procedure-allergy-conflicts:read",
  "procedure-allergy-conflicts:write",
  "products:read",
  "products:write",
  "products:delete",
  "product-categories:read",
  "product-categories:write",
  "product-categories:delete",
  "product-allergy-conflicts:read",
  "product-allergy-conflicts:write",
  "reports:read",
  "roles:read",
  "roles:write",
  "rooms:read",
  "rooms:write",
  "rooms:delete",
  "schedule-availability:write",
  "schedule-availability:delete",
  "suppliers:read",
  "suppliers:write",
  "suppliers:delete",
  "users:read",
  "users:write",
] as const;

export type Scope = (typeof ALL_SCOPES)[number];

export type ScopeMatrixRow = {
  resource: string;
  actions: ("read" | "write" | "delete")[];
};

/**
 * Group scopes by resource, preserving the order in which resources first
 * appear. Each row lists the actions ("read" / "write" / "delete") that
 * actually exist on the backend for that resource; the role editor uses
 * this to render only the checkboxes that map to a real scope.
 */
export function scopeMatrix(scopes: readonly string[]): ScopeMatrixRow[] {
  const order: string[] = [];
  const map = new Map<string, Set<"read" | "write" | "delete">>();

  for (const s of scopes) {
    const idx = s.lastIndexOf(":");
    if (idx < 0) continue;
    const resource = s.slice(0, idx);
    const action = s.slice(idx + 1) as "read" | "write" | "delete";
    if (!map.has(resource)) {
      map.set(resource, new Set());
      order.push(resource);
    }
    map.get(resource)!.add(action);
  }

  const ACTION_ORDER = ["read", "write", "delete"] as const;
  return order.map((resource) => ({
    resource,
    actions: ACTION_ORDER.filter((a) => map.get(resource)!.has(a)),
  }));
}
