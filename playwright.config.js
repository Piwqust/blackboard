import { defineConfig } from '@playwright/test';
// TEST_PORT lets two checkouts (e.g. worktrees) run their suites side by side.
const port = Number(process.env.TEST_PORT || 4190);
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  expect: {timeout: 10000},
  use: { headless: true, serviceWorkers: 'block' },
  webServer: { command: 'node scripts/serve-test.mjs', url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI, stdout: 'ignore', stderr: 'ignore' },
  projects: ['pwa', 'edge-extension'].map(name => ({name, use: {baseURL: `http://127.0.0.1:${port}/dist/${name}/`}}))
});
