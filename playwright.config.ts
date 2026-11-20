import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });

/**
 * WATCH MODE – set SLOW_MO (milliseconds) to slow every click/type so you can follow along:
 *   $env:SLOW_MO=1000; npx playwright test --headed --workers=1 --project=chromium
 * Leave it unset for normal (fast) runs.
 */
const SLOW_MO = Number(process.env.SLOW_MO || 0);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Slow runs need more time per test */
  timeout: SLOW_MO ? 180_000 : 30_000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { open: 'never' }], ['list']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.BASE_URL || 'https://milesstaging.transight.net',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: SLOW_MO ? 'on' : 'retain-on-failure', // watch mode also records every test
    launchOptions: { slowMo: SLOW_MO },
  },

  /* Configure projects for major browsers */
  projects: [
    /* Logs in once and saves the admin session to .auth/admin.json */
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    /* Logged-in module tests (Dashboard, Fleet Owners, Vehicles, Staff, Dealers…).
       They share one browser tab (fixtures/adminTest.ts) and run in file order. */
    {
      name: 'chromium',
      testMatch: /miles\.spec\.ts/,
      grepInvert: /@login/,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' },
      dependencies: ['setup'],
    },

    /* Chrome login tests – run only AFTER all logged-in tests have finished:
       the server allows one session per user, so a fresh admin login would
       log out the tab the module tests are using. */
    {
      name: 'chromium-login',
      testMatch: /miles\.spec\.ts/,
      grep: /@login/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['chromium'],
    },

    /* Cross-browser: only the @login tests (logged out, no setup needed) */
    {
      name: 'firefox',
      testMatch: /miles\.spec\.ts/,
      grep: /@login/,
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      testMatch: /miles\.spec\.ts/,
      grep: /@login/,
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
