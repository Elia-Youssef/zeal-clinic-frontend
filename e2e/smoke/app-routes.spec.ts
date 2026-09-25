import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { repoRoot } from "../support/env";
import { APP_ROUTES } from "../support/routes";

// No browser needed: keeps the walk's route table in step with src/App.tsx.
test("the route walk covers every route in src/App.tsx", () => {
  const source = fs.readFileSync(path.join(repoRoot, "src", "App.tsx"), "utf8");
  const declared = [...source.matchAll(/\bpath="([^"]+)"/g)].map(([, p]) => (p === "/" || p === "*" ? p : `/${p}`));
  expect(APP_ROUTES.map((r) => r.path).sort()).toEqual(declared.sort());
});
