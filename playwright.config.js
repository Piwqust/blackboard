import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  expect: {timeout: 10000},
  use: { headless: true, serviceWorkers: 'block' },
  webServer: { command: 'python3 -m http.server 4190 --bind 127.0.0.1', url: 'http://127.0.0.1:4190', reuseExistingServer: !process.env.CI, stdout: 'ignore', stderr: 'ignore' },
  projects: ['pwa', 'edge-extension'].map(name => ({name, use: {baseURL: `http://127.0.0.1:4190/dist/${name}/`}}))
});
