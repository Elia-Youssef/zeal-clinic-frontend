/** Where a real value for a route's path parameter comes from (read through the API at setup). */
export type RouteParam = { list: string; key: "id" | "name" };

export type AppRoute = {
  /** The path as src/App.tsx declares it, with a leading slash. */
  path: string;
  /** The tabs layout the page renders in, if any (its tab strip is recorded). */
  tabs?: string;
  param?: RouteParam;
};

const byId = (list: string): RouteParam => ({ list, key: "id" });

/** Every route in src/App.tsx, in declaration order. */
export const APP_ROUTES: AppRoute[] = [
  { path: "/" },
  { path: "/dashboard" },
  { path: "/profile" },
  { path: "/patients" },
  { path: "/patients/list", tabs: "patients" },
  { path: "/patients/allergies", tabs: "patients" },
  { path: "/patients/medicines", tabs: "patients" },
  { path: "/patients/:id", param: byId("/patients") },
  { path: "/schedule" },
  { path: "/schedule/calendar", tabs: "schedule" },
  { path: "/schedule/rooms", tabs: "schedule" },
  { path: "/reports" },
  { path: "/connection" },
  { path: "/inventory" },
  { path: "/inventory/products", tabs: "inventory" },
  { path: "/inventory/categories", tabs: "inventory" },
  { path: "/inventory/products/:id", param: byId("/products") },
  { path: "/suppliers" },
  { path: "/suppliers/:id", param: byId("/suppliers") },
  { path: "/financials" },
  { path: "/financials/invoices", tabs: "financials" },
  { path: "/financials/expenses", tabs: "financials" },
  { path: "/financials/discounts", tabs: "financials" },
  { path: "/financials/currencies", tabs: "financials" },
  { path: "/financials/invoices/:id", param: byId("/invoices?type=patient") },
  { path: "/financials/expenses/:id", param: byId("/expenses") },
  { path: "/financials/discounts/:id", param: byId("/discounts") },
  { path: "/services" },
  { path: "/services/procedures", tabs: "services" },
  { path: "/services/types", tabs: "services" },
  { path: "/services/categories", tabs: "services" },
  { path: "/services/procedures/:id", param: byId("/procedures") },
  { path: "/team" },
  { path: "/team/employees", tabs: "team" },
  { path: "/team/holidays", tabs: "team" },
  { path: "/team/:id", param: byId("/employees") },
  { path: "/settings" },
  { path: "/settings/roles", tabs: "settings" },
  { path: "/settings/staff", tabs: "settings" },
  { path: "/settings/audit-log", tabs: "settings" },
  { path: "/settings/about", tabs: "settings" },
  { path: "/settings/roles/:name", param: { list: "/roles", key: "name" } },
  { path: "/settings/staff/:id", param: byId("/users") },
  { path: "*" },
];

/** A path that no route declares, to exercise the catch-all. */
export const UNKNOWN_PATH = "/no-such-page";

/** The URL to open for a route, with its parameter filled from `params` (keyed by route path). */
export function fillPath(route: AppRoute, params: Record<string, string>): string {
  if (route.path === "*") return UNKNOWN_PATH;
  if (!route.param) return route.path;
  const value = params[route.path];
  if (!value) throw new Error(`no value for the parameter of ${route.path}`);
  return route.path.replace(/:[a-z]+/i, encodeURIComponent(value));
}

/** The paths of the tabs layout a route renders in. */
export function tabPaths(route: AppRoute): string[] {
  if (!route.tabs) return [];
  return APP_ROUTES.filter((r) => r.tabs === route.tabs).map((r) => r.path);
}

/** A file-name friendly form of a route path. */
export function routeSlug(path: string): string {
  if (path === "/") return "root";
  if (path === "*") return "unknown";
  return path.replace(/^\//, "").replace(/:/g, "").replace(/[^a-z0-9]+/gi, "-");
}

/**
 * The declared route a pathname renders, the way React Router picks it: static segments win over
 * parameters. Anything else is the catch-all "*".
 */
export function matchRoute(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  let best: { path: string; score: number } | null = null;
  for (const route of APP_ROUTES) {
    if (route.path === "*") continue;
    const segments = route.path.split("/").filter(Boolean);
    if (segments.length !== parts.length) continue;
    let score = 0;
    let ok = true;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].startsWith(":")) continue;
      if (segments[i] !== parts[i]) {
        ok = false;
        break;
      }
      score++;
    }
    if (ok && (!best || score > best.score)) best = { path: route.path, score };
  }
  return best ? best.path : "*";
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?/g;
const ASSET_HASH = /(\/assets\/[\w.-]+?)-[\w-]{8,}\.(js|css)\b/g;

/** Record ids, dates and build hashes replaced by placeholders, so goldens stay stable across data and builds. */
export function normalizeText(text: string): string {
  return text.replace(UUID, ":id").replace(ISO_DATE, ":date").replace(ASSET_HASH, "$1-*.$2");
}

/** The path of a URL (no origin, no query), normalized. */
export function normalizeUrlPath(url: string): string {
  try {
    return normalizeText(new URL(url).pathname);
  } catch {
    return normalizeText(url);
  }
}

/** "GET /api/patients/:id" for a request. */
export function describeCall(method: string, url: string): string {
  return `${method} ${normalizeUrlPath(url)}`;
}
