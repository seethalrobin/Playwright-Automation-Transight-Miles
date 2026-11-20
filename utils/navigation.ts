import { Page } from '@playwright/test';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Opens a module. If the app is already loaded, clicks the sidebar link
 * (in-app navigation, no page reload). Only the very first visit loads the URL.
 * Reloads trigger the app's rate-limited token refresh – avoid them.
 */
export async function openModule(page: Page, menuName: string, path: string) {
  const appLoaded = page.url().startsWith('http') && !page.url().includes('/login');
  if (!appLoaded) {
    await page.goto(path);
    return;
  }
  // Some links carry a badge count, e.g. "Fuel Cards 14" – allow an optional number.
  const name = new RegExp(`^${escapeRegex(menuName)}(\\s*\\d+)?$`);
  await page.getByRole('link', { name }).first().click();
  // Some links redirect to a sub-page, e.g. /portal/finance → /portal/finance/transactions
  await page.waitForURL(url => url.pathname === path || url.pathname.startsWith(`${path}/`));
}
