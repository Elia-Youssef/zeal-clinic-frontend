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
// The visual goldens (screenshots) live outside the repository, in the folder E2E_VISUAL_DIR names, and the
// visual project runs only when E2E_VISUAL=1 points at them: a fresh clone has nothing to compare against.
// E2E_UPDATE_GOLDENS=1 records them again; otherwise a missing golden fails instead of being written.
const visualDir = process.env.E2E_VISUAL === '1' ? process.env.E2E_VISUAL_DIR : undefined
const recording = process.env.E2E_UPDATE_GOLDENS === '1'

const demoProjects: Project[] = [
  // Every route for each role, recorded in e2e/golden/route-access.json.
  { name: 'smoke', testDir: './e2e/smoke' },
]

const visualProjects: Project[] = visualDir
  ? [
      // Screens of fixed data, compared with the goldens after every other scenario project has finished, so
      // nothing changes under them (the calendar shows every room there is, for instance).
      {
        name: 'visual',
        testDir: './e2e/visual',
        dependencies: ['flows', 'mobile', 'dark', 'tz-foreign'],
        snapshotDir: visualDir,
        snapshotPathTemplate: '{snapshotDir}/{projectName}/{testFileName}/{arg}-{platform}{ext}',
        expect: {
          timeout: 10_000,
          toHaveScreenshot: {
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
            maxDiffPixelRatio: 0.001,
            stylePath: path.join(import.meta.dirname, 'e2e', 'visual', 'screenshot.css'),
          },
        },
      },
    ]
  : []

// Specs build their own data through the API and share the database, so every name is unique.
const scenarioProjects: Project[] = [
  // Checks the instance before the specs start; the serial project runs after all the others.
  { name: 'scenario', testDir: './e2e', testMatch: /scenario\.setup\.ts/, teardown: 'serial' },
  { name: 'flows', testDir: './e2e/flows', dependencies: ['scenario'] },
  { name: 'mobile', testDir: './e2e/mobile', dependencies: ['scenario'], use: { viewport: { width: 390, height: 844 } } },
  { name: 'dark', testDir: './e2e/dark', dependencies: ['scenario'], use: { colorScheme: 'dark' } },
  { name: 'tz-foreign', testDir: './e2e/tz-foreign', dependencies: ['scenario'], use: { timezoneId: 'America/New_York' } },
  ...visualProjects,
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
  updateSnapshots: recording ? 'all' : 'none',
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
