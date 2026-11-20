import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import {
  ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_STORAGE_STATE,
  FLEET_OWNER_USERNAME, FLEET_OWNER_PASSWORD, FLEET_OWNER_STORAGE_STATE,
} from '../../utils/credentials';

// Logs in once per user and saves the session, so module tests start already
// logged in (and don't trip the server's sign-in rate limit).
setup('authenticate as admin', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(ADMIN_USERNAME, ADMIN_PASSWORD);
  await new DashboardPage(page).expectLoaded();
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});

setup('authenticate as fleet owner', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(FLEET_OWNER_USERNAME, FLEET_OWNER_PASSWORD);
  // Fleet owners land on their own portal, not the admin dashboard
  await page.waitForURL('**/portal');
  await expect(page.getByRole('heading', { name: /^Welcome back,/ })).toBeVisible();
  await page.context().storageState({ path: FLEET_OWNER_STORAGE_STATE });
});
