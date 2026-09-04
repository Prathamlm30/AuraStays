// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright_tests',
  /* Run tests in files sequentially */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Force a single worker locally to prevent database race conditions */
  workers: 1,

  /* Reporter to use */
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Commented out extra browsers to avoid running tests 3x simultaneously on localhost
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});