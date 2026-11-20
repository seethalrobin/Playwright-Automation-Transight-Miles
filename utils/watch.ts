import { Locator, Page } from '@playwright/test';

/**
 * Watch-mode helpers. Active only when SLOW_MO is set, e.g.
 *   $env:SLOW_MO=1000; npx playwright test --headed --workers=1 --project=chromium
 * Normal runs (SLOW_MO unset) stay fast.
 */
const SLOW_MO = Number(process.env.SLOW_MO || 0);
export const WATCH = SLOW_MO > 0;

/** Pause between steps so you can see each screen (default 3 s in watch mode). */
const STEP_PAUSE = Number(process.env.STEP_PAUSE || (WATCH ? 3000 : 0));

/** Delay between typed characters (default 120 ms in watch mode). */
const TYPE_DELAY = Number(process.env.TYPE_DELAY || (WATCH ? 120 : 0));

/** Fills a field – instantly in normal runs, letter-by-letter in watch mode. */
export async function typeInto(field: Locator, text: string) {
  if (!WATCH) {
    await field.fill(text);
    return;
  }
  await field.click();
  await field.clear();
  await field.pressSequentially(text, { delay: TYPE_DELAY });
}

/** Holds the screen for a moment in watch mode (no-op in normal runs). */
export async function watchPause(page: Page) {
  if (STEP_PAUSE > 0) await page.waitForTimeout(STEP_PAUSE);
}
