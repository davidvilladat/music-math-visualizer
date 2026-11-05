import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
    // A synthetic microphone for the mic-source tests; unused by the others.
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
