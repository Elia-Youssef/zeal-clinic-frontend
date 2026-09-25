import { apiGet } from "./support/api";
import { ROLES } from "./support/demo-credentials";
import { expect, test } from "./support/fixtures";

// Runs before the scenario projects: the instance is fresh and every role can use the API.
test("the scenario instance is up with one account per role", async ({ runtime, scenario }) => {
  expect(runtime.instance).toBe("scenario");
  const health = await fetch(`${runtime.baseURL}/health`).then((r) => r.json());
  expect(health.status).toBe("ok");
  for (const role of ROLES) {
    const session = runtime.sessions[role];
    expect(session.role).toBe(role);
    await apiGet(runtime.baseURL, session.token, "/auth/verify");
  }
  // Migrations only: no patients before the specs create theirs.
  const patients = await scenario.get<{ total: number }>("/patients?limit=1");
  expect(patients.total).toBe(0);
});
