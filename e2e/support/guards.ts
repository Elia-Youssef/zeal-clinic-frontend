import type { ConsoleMessage, Page, Request, Response } from "@playwright/test";
import type { Role } from "./demo-credentials";
import {
  allowedForbidden,
  isAllowedConsoleError,
  type ConsoleAllowlist,
  type ConsoleEntry,
  type GuardPart,
  type RouteAccess,
} from "./golden";
import { describeCall, matchRoute, normalizeText, normalizeUrlPath } from "./routes";

export type GuardOptions = {
  role: Role | null;
  project: string;
  origin: string;
  /** Record 403s and console errors instead of checking them. */
  update: boolean;
  golden: RouteAccess | null;
  allowlist: ConsoleAllowlist;
};

const RESOURCE_ERROR = /^Failed to load resource: the server responded with a status of (\d{3})/;

/** An API error a test causes on purpose, e.g. "401 POST /api/auth/login" ("*" matches any status or path). */
type ExpectedError = { status: number | "*"; method: string; path: string };

/** The dashboard's error-boundary screen (src/components/shared/error-boundary.tsx). */
export function errorScreen(page: Page) {
  return page.getByRole("heading", { name: "Something went wrong", exact: true });
}

/**
 * Watches every page of a test. A test fails on an uncaught page error, a console error missing from
 * the allowlist, any /api 5xx, a 403 the route-access golden doesn't list for that role and page, and
 * the error-boundary screen. Errors a test provokes on purpose are declared with expectError() and
 * expectPageError().
 */
export class Guards {
  private readonly problems: string[] = [];
  private readonly pages: Page[] = [];
  private readonly inflight = new Set<Request>();
  private readonly requestRoute = new WeakMap<Request, string>();
  private readonly forbidden = new Map<string, Set<string>>();
  private readonly consoleErrors: ConsoleEntry[] = [];
  private readonly expected: ExpectedError[] = [];
  private readonly pageRoles = new WeakMap<Page, Role | null>();
  private readonly expectedPageErrors: RegExp[] = [];
  /** Every /api response in order, as "403 GET /api/x". */
  readonly calls: string[] = [];

  constructor(private readonly options: GuardOptions) {}

  /**
   * Allows an API error the test provokes on purpose, such as a wrong password or a room clash:
   * "409 POST /api/appointments", "401 * /api/*". The response still counts in `calls`. 5xx stay fatal.
   */
  expectError(spec: string): void {
    const match = /^(\d{3}|\*)\s+(\S+)\s+(\S+)$/.exec(spec.trim());
    if (!match) throw new Error(`expectError: "${spec}" is not "<status> <METHOD> <path>"`);
    const status = match[1] === "*" ? "*" : Number(match[1]);
    if (status !== "*" && status >= 500) throw new Error("expectError: server errors are never expected");
    this.expected.push({ status, method: match[2].toUpperCase(), path: match[3] });
  }

  /** Allows an uncaught page error the test provokes on purpose (matched against its message). */
  expectPageError(message: RegExp): void {
    this.expectedPageErrors.push(message);
  }

  private isExpected(status: number, method: string | null, path: string): boolean {
    const glob = (pattern: string, value: string) =>
      new RegExp(`^${pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`).test(value);
    return this.expected.some(
      (e) =>
        (e.status === "*" || e.status === status) &&
        (method === null || e.method === "*" || e.method === method) &&
        glob(e.path, path),
    );
  }

  /** Starts watching a page; `role` is who is signed in there when it isn't the test's own role. */
  watch(page: Page, role?: Role | null): void {
    if (this.pages.includes(page)) return;
    this.pages.push(page);
    if (role !== undefined) this.pageRoles.set(page, role);
    page.on("pageerror", (error) => {
      if (this.expectedPageErrors.some((re) => re.test(error.message))) return;
      this.problems.push(`uncaught error on ${this.routeOf(page.url())}: ${error.message}`);
    });
    page.on("console", (message) => {
      if (message.type() === "error") this.onConsoleError(page, message);
    });
    page.on("request", (request) => {
      if (!this.isApi(request.url())) return;
      this.requestRoute.set(request, this.routeOf(page.url()));
      if (!this.isEventStream(request.url())) this.inflight.add(request);
    });
    page.on("requestfinished", (request) => this.inflight.delete(request));
    page.on("requestfailed", (request) => this.inflight.delete(request));
    page.on("response", (response) => this.onResponse(page, response));
  }

  /** API requests still waiting for an answer (the event stream never ends, so it doesn't count). */
  pendingRequests(): number {
    return this.inflight.size;
  }

  /** 403 calls seen while the page showed `route`. */
  forbiddenOn(route: string): string[] {
    return [...(this.forbidden.get(route) ?? [])].sort();
  }

  /** Looks for the error screen on the pages that are still open (call it before closing extra contexts). */
  async inspectPages(): Promise<void> {
    for (const page of this.pages) {
      if (page.isClosed()) continue;
      if ((await errorScreen(page).count()) > 0) this.problems.push(`error screen on ${this.routeOf(page.url())}`);
    }
  }

  /** Checks the pages that are still open, then fails the test on anything the guards caught. */
  async finish(): Promise<GuardPart> {
    await this.inspectPages();
    return {
      project: this.options.project,
      role: this.options.role,
      forbidden: Object.fromEntries([...this.forbidden].map(([route, calls]) => [route, [...calls].sort()])),
      console: this.consoleErrors,
    };
  }

  problemReport(): string | null {
    if (!this.problems.length) return null;
    const unique = [...new Set(this.problems)];
    return `Guards caught ${unique.length} problem(s):\n${unique.map((p) => `  - ${p}`).join("\n")}`;
  }

  private isApi(url: string): boolean {
    try {
      const u = new URL(url);
      return u.origin === this.options.origin && u.pathname.startsWith("/api/");
    } catch {
      return false;
    }
  }

  private isEventStream(url: string): boolean {
    return new URL(url).pathname === "/api/events";
  }

  private routeOf(url: string): string {
    try {
      return matchRoute(new URL(url).pathname);
    } catch {
      return url;
    }
  }

  private onResponse(page: Page, response: Response): void {
    const request = response.request();
    if (!this.isApi(request.url())) return;
    const status = response.status();
    const call = describeCall(request.method(), request.url());
    const route = this.requestRoute.get(request) ?? this.routeOf(page.url());
    this.calls.push(`${status} ${call}`);
    if (status >= 500) {
      this.problems.push(`HTTP ${status} from ${call} on ${route}`);
    } else if (status === 403) {
      if (this.isExpected(403, request.method(), normalizeUrlPath(request.url()))) return;
      const seen = this.forbidden.get(route) ?? new Set<string>();
      seen.add(call);
      this.forbidden.set(route, seen);
      const role = this.pageRoles.has(page) ? (this.pageRoles.get(page) ?? null) : this.options.role;
      const allowed = allowedForbidden(this.options.golden, role, route);
      if (!this.options.update && !allowed.includes(call)) {
        this.problems.push(`403 from ${call} on ${route}, not listed for ${role ?? "a signed-out user"} in route-access.json`);
      }
    }
  }

  private onConsoleError(page: Page, message: ConsoleMessage): void {
    const text = message.text();
    const source = message.location().url;
    const resource = RESOURCE_ERROR.exec(text);
    // Failed API calls are judged by status above: 5xx always fails, 403 goes by the golden.
    if (resource && this.isApi(source)) {
      const status = Number(resource[1]);
      if (status === 403 || status >= 500) return;
      if (this.isExpected(status, null, normalizeUrlPath(source))) return;
    }
    const entry: ConsoleEntry = resource
      ? { text: normalizeText(text), url: normalizeUrlPath(source) }
      : { text: normalizeText(text.replaceAll(this.options.origin, "")) };
    this.consoleErrors.push(entry);
    if (!this.options.update && !isAllowedConsoleError(this.options.allowlist, entry)) {
      const where = entry.url ? ` (${entry.url})` : "";
      this.problems.push(`console error on ${this.routeOf(page.url())}: ${entry.text}${where}`);
    }
  }
}
