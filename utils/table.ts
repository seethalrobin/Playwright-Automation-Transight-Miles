import { Locator, Page, Response, expect } from '@playwright/test';

/**
 * Waits for the "create" API response. A 401 is skipped: it means the short-lived
 * access token just expired – the app refreshes it and re-sends the same request,
 * and the response to THAT re-sent request is the one that counts.
 */
export function waitForCreateResponse(page: Page, urlPattern: RegExp, timeout = 20000): Promise<Response> {
  return page.waitForResponse(
    r => r.request().method() === 'POST'
      && !r.url().includes('/auth/')
      && urlPattern.test(r.url())
      && r.status() !== 401,
    { timeout },
  );
}
import { typeInto, watchPause } from './watch';

/**
 * Searches a list page and returns the single row containing `text`.
 * Waits for the list's first load to finish BEFORE typing – otherwise the
 * initial (unfiltered) load can arrive after the search and overwrite it.
 * Retypes the search if the row does not show up the first time.
 */
export async function searchTableRow(page: Page, searchBox: Locator, text: string): Promise<Locator> {
  const rows = page.locator('tbody tr');

  // Wait for the list to finish loading. (No reload-and-retry on "Failed to load":
  // reloading calls the app's rate-limited token refresh and makes it worse.)
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  await expect(rows.first()).not.toContainText(/Loading/i, { timeout: 15000 });
  await expect(
    page.getByText(/Failed to load/i),
    'List failed to load – usually the app\'s token refresh hit the server rate limit (HTTP 429)',
  ).toHaveCount(0);
  await page.waitForLoadState('networkidle').catch(() => {});

  const row = rows.filter({ hasText: text });
  await expect(async () => {
    await searchBox.clear();
    await typeInto(searchBox, text);
    await expect(row).toHaveCount(1, { timeout: 5000 });
  }).toPass({ timeout: 20000 });

  await watchPause(page);
  return row;
}
