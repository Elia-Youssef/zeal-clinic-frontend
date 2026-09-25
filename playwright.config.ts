import path from 'node:path'
import { defineConfig, devices, type Project } from '@playwright/test'

// End-to-end tests against the Go server with the embedded dashboard build. The global setup starts
// the server through the backend's scripts/stack.ps1 (BACKEND_DIR); settings are listed in e2e/support/env.ts.
// One run starts one server, because the clinic allows a single node per machine: E2E_INSTANCE=demo (the
// default) for the per-role walk on demo data, E2E_INSTANCE=scenario for the flows on a fresh database.
const artifactsDir = path.resolve(process.env.E2E_ARTIFACTS_DIR || 'test-results')
const port = Number(process.env.E2E_PORT || 55580)
const onCi = !!process.env.CI
const scenario = process.env.E2E_INSTANCE === 'scenario'

const demoProjects: Project[] = [
  // Every route for each role, recorded in e2e/golden/route-access.json.
  { name: 'smoke', testDir: './e2e/smoke' },
]

// Specs build their own data through the API and share the database, so every name is unique.
const scenarioProjects: Project[] = [
  // Checks the instance before the specs start; the serial project runs after all the others.
  { name: 'scenario', testDir: './e2e', testMatch: /scenario\.setup\.ts/, teardown: 'serial' },
  { name: 'flows', testDir: './e2e/flows', dependencies: ['scenario'] },
  { name: 'mobile', testDir: './e2e/mobile', dependencies: ['scenario'], use: { viewport: { width: 390, height: 844 } } },
  { name: 'dark', testDir: './e2e/dark', dependencies: ['scenario'], use: { colorScheme: 'dark' } },
  { name: 'tz-foreign', testDir: './e2e/tz-foreign', dependencies: ['scenario'], use: { timezoneId: 'America/New_York' } },
  // Global state (roles, the sign-in rate limit, force sync): one worker, file by file, after everything
  // else has finished, whatever the outcome (it is the scenario project's teardown).
  { name: 'serial', testDir: './e2e/serial', workers: 1, fullyParallel: false },
]

export default defineConfig({
  testDir: './e2e',
  outputDir: path.join(artifactsDir, 'output'),
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  forbidOnly: onCi,
  retries: onCi ? 1 : 0,
  workers: onCi ? 2 : 4,
  timeout: scenario ? 90_000 : 60_000,
  grep: process.env.E2E_GREP ? new RegExp(process.env.E2E_GREP, 'i') : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(artifactsDir, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(artifactsDir, 'results.json') }],
    ['junit', { outputFile: path.join(artifactsDir, 'junit.xml') }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    // The date picker's data-day uses toLocaleDateString; the clinic runs on Beirut time.
    locale: 'en-US',
    timezoneId: 'Asia/Beirut',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    launchOptions: {
      // Anything but loopback goes to a closed port, so the browser can't reach the network.
      proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' },
    },
  },
  projects: scenario ? scenarioProjects : demoProjects,
})
