import { defineConfig } from '@playwright/test';
// TEST_PORT lets several checkouts run their browser tests side by side; the
// test server reads the same variable.
const origin = `http://127.0.0.1:${Number(process.env.TEST_PORT) || 4190}`;
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  expect: {timeout: 10000},
  use: { headless: true, serviceWorkers: 'block' },
  webServer: { command: 'node scripts/serve-test.mjs', url: origin, reuseExistingServer: !process.env.CI, stdout: 'ignore', stderr: 'ignore' },
  projects: ['pwa', 'edge-extension'].map(name => ({name, use: {baseURL: `${origin}/dist/${name}/`}}))
});
