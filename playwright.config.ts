import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:4173',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: '4173',
      DISABLE_DB: '1',
    },
  },
  reporter: process.env.CI
    ? [
        ['html'],
        ['json', { outputFile: 'playwright-report/results.json' }],
        ['line'], // Shows detailed test names and results
        ['github'], // Shows detailed output in GitHub Actions
      ]
    : [['html'], ['list'], ['line']],
});
