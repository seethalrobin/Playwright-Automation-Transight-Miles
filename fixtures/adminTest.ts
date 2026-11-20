import { test as base, expect, Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE, FLEET_OWNER_STORAGE_STATE } from '../utils/credentials';

/**
 * `test` for logged-in tests.
 *
 * WHY: the app calls /api/v1/auth/refresh (several times in parallel) on EVERY
 * full page load, and the server rate-limits that endpoint (HTTP 429). One fresh
 * browser tab per test + page.goto() reloads quickly hit the limit and the app
 * shows "Failed to load …" / "Session Expired".
 *
 * So all logged-in tests of one user in a worker share ONE browser tab, opened
 * once from the saved session. Page objects navigate with the sidebar (no reload).
 *
 *   test           → admin dashboard      (session .auth/admin.json)
 *   fleetOwnerTest → fleet owner portal   (session .auth/fleetOwner.json)
 */
type WorkerFixtures = { sharedPage: Page };

function sharedTabTest(storageState: string) {
  return base.extend<{}, WorkerFixtures>({
    sharedPage: [
      async ({ browser }, use, workerInfo) => {
        const context = await browser.newContext({
          ...workerInfo.project.use,
          storageState,
        } as any);
        const page = await context.newPage();
        await use(page);
        await context.storageState({ path: storageState }); // keep latest refresh token
        await context.close();
      },
      { scope: 'worker' },
    ],

    // Every logged-in test gets the shared tab as its `page`.
    page: async ({ sharedPage }, use, testInfo) => {
      await use(sharedPage);
      // The shared tab is not covered by the automatic failure screenshot – attach one.
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('screenshot-on-failure', {
          body: await sharedPage.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
      }
      // Close any dialog left open by a failed test so the next test starts clean.
      await sharedPage.keyboard.press('Escape').catch(() => {});
    },
  });
}

export const test = sharedTabTest(ADMIN_STORAGE_STATE);
export const fleetOwnerTest = sharedTabTest(FLEET_OWNER_STORAGE_STATE);

export { expect };
