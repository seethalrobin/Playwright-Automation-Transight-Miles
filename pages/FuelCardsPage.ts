import { Page, Locator, expect } from '@playwright/test';
import { openModule } from '../utils/navigation';
import { typeInto, watchPause } from '../utils/watch';

export type FuelTab = 'Requested Cards' | 'Issued Cards' | 'Failed Cards' | 'Vehicles Without Card';

/** Heading and table columns shown for each tab. */
export const FUEL_TABS: Record<FuelTab, { heading: string; columns: string[] }> = {
  'Requested Cards':       { heading: 'Card Requests',          columns: ['Vehicle', 'Fleet Owner', 'Requested On', 'Status', 'Action'] },
  'Issued Cards':          { heading: 'Issued Fuel Cards',      columns: ['Vehicle', 'Fleet Owner', 'Card Number', 'Issued On', 'Expires', 'Issued By', 'Status'] },
  'Failed Cards':          { heading: 'Failed Card Requests',   columns: ['Vehicle', 'Fleet Owner', 'Failed On', 'Reason', 'Status', 'Action'] },
  'Vehicles Without Card': { heading: 'Vehicles Without a Card', columns: ['Vehicle', 'Fleet Owner', 'Make & Type', 'Status', 'Action'] },
};

export class FuelCardsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchBox: Locator;
  readonly rows: Locator;
  readonly issueDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Fuel Cards (IOCL)' });
    this.searchBox = page.getByPlaceholder('Search vehicle or fleet owner…');
    this.rows = page.locator('tbody tr');
    this.issueDialog = page.getByRole('dialog');
  }

  async goto() {
    await openModule(this.page, 'Fuel Cards', '/fuel-cards');
    await expect(this.heading).toBeVisible();
    await watchPause(this.page);
  }

  /** Tab buttons carry a live count, e.g. "Issued Cards (34)". */
  tab(name: FuelTab): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${name}\\s*\\(\\d+\\)$`) });
  }

  async tabCount(name: FuelTab): Promise<number> {
    const label = await this.tab(name).innerText();
    return Number(label.match(/\((\d+)\)/)![1]);
  }

  async openTab(name: FuelTab) {
    await this.tab(name).click();
    await expect(this.page.getByRole('heading', { name: FUEL_TABS[name].heading, exact: true })).toBeVisible();
    await this.waitForRows();
    await watchPause(this.page);
  }

  async waitForRows() {
    await expect(this.rows.first()).toBeVisible({ timeout: 15000 });
    await expect(this.rows.first()).not.toContainText(/Loading/i, { timeout: 15000 });
  }

  /** Header cell of the current table (headers are styled in CAPS – match case-insensitively). */
  column(name: string): Locator {
    return this.page.getByRole('columnheader', { name: new RegExp(`^${name.replace(/[&]/g, '\\&')}$`, 'i') });
  }

  /** Fleet owner name in a row (first line of the 2nd cell). */
  async fleetOwnerOf(row: Locator): Promise<string> {
    return (await row.locator('td').nth(1).innerText()).split('\n')[0].trim();
  }

  async search(text: string) {
    await typeInto(this.searchBox, text);
    await this.page.waitForTimeout(1000); // list filters as you type
    await this.waitForRows();
    await watchPause(this.page);
  }

  /** Opens the "Issue Fuel Card" dialog for a row – does NOT submit it. */
  async openIssueDialog(row: Locator) {
    await row.getByRole('button', { name: 'Issue Card' }).click();
    await expect(this.issueDialog.getByRole('heading', { name: 'Issue Fuel Card' })).toBeVisible();
    await watchPause(this.page);
  }

  /**
   * Issues a card for the (single) vehicle of a fleet owner listed under
   * "Vehicles Without Card". SENDS A REAL CreateCard REQUEST TO IOCL (sandbox on staging).
   */
  async issueCardForOwner(ownerName: string) {
    await this.openTab('Vehicles Without Card');
    await this.search(ownerName);
    const row = this.rows.filter({ hasText: ownerName });
    await expect(row).toHaveCount(1);
    await this.openIssueDialog(row);
    await expect(this.issueDialog).toContainText(ownerName);
    await expect(this.issueDialog).not.toContainText('does not have an IOCL fuel-card account');

    const issued = this.page.waitForResponse(
      r => r.request().method() === 'POST' && /fuel/i.test(r.url()) && r.status() !== 401,
      { timeout: 150_000 }, // IndianOil can take up to 2 minutes
    );
    await this.issueDialog.getByRole('button', { name: 'Issue Card' }).click();
    const response = await issued;
    await watchPause(this.page);
    return response;
  }

  /** Finds the owner's card under "Issued Cards". */
  async issuedRowFor(ownerName: string): Promise<Locator> {
    await this.openTab('Issued Cards');
    await this.search(ownerName);
    const row = this.rows.filter({ hasText: ownerName });
    await expect(row).toHaveCount(1, { timeout: 15000 });
    return row;
  }

  async cancelIssueDialog() {
    await this.issueDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(this.issueDialog).toBeHidden();
  }
}
