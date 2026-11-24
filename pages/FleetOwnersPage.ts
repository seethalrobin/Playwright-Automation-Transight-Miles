import { Page, Locator, expect } from '@playwright/test';
import { FleetOwnerData } from '../test-data/fleetOwner';
import { typeInto, watchPause } from '../utils/watch';
import { searchTableRow, waitForCreateResponse } from '../utils/table';
import { openModule } from '../utils/navigation';

export class FleetOwnersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly manualOnboardingButton: Locator;
  readonly nextStepButton: Locator;
  readonly completeOnboardingButton: Locator;

  // Step 1 – Account & Contact Credentials
  readonly username: Locator;
  readonly password: Locator;
  readonly contactName: Locator;
  readonly mobile: Locator;
  readonly email: Locator;

  // Step 2 – Business & Address Profile
  readonly businessName: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly pincode: Locator;

  // Step 3 – KYC Documents & Settlements (all optional)
  readonly pan: Locator;
  readonly gstin: Locator;
  readonly bankName: Locator;
  readonly accountNumber: Locator;
  readonly ifsc: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Fleet Owner Management' });
    this.manualOnboardingButton = page.getByRole('button', { name: /Manual Onboarding/ });
    this.nextStepButton = page.getByRole('button', { name: 'Next Step' });
    this.completeOnboardingButton = page.getByRole('button', { name: 'Complete Onboarding' });

    this.username = page.getByPlaceholder('ramesh_transport');
    this.password = page.getByPlaceholder('Strong password');
    this.contactName = page.getByPlaceholder('Ramesh K');
    this.mobile = page.getByPlaceholder('9876543210');
    this.email = page.getByPlaceholder('ramesh@example.com');

    this.businessName = page.getByPlaceholder('e.g. Ramesh Transport & Logistics');
    this.city = page.getByPlaceholder('e.g. Mumbai');
    this.state = page.getByPlaceholder('e.g. Maharashtra');
    this.pincode = page.getByPlaceholder('400001');

    this.pan = page.getByPlaceholder('ABCDE1234F');
    this.gstin = page.getByPlaceholder('29ABCDE1234F1Z5');
    this.bankName = page.getByPlaceholder('e.g. HDFC Bank');
    this.accountNumber = page.getByPlaceholder('1234567890');
    this.ifsc = page.getByPlaceholder('HDFC0001234');
  }

  async goto() {
    await openModule(this.page, 'Fleet Owners', '/fleet-owners');
    // The onboarding wizard and its success screen live on the same URL as the
    // directory, so the sidebar link does not leave them – use the in-page buttons.
    const backButton = this.page.getByRole('button', { name: /Go to Fleet Owners Directory|Back to Directory/ }).first();
    // (it can vanish while the view re-renders, so don't wait long for it)
    if (await backButton.isVisible()) await backButton.click({ timeout: 3000 }).catch(() => {});
    await expect(this.heading).toBeVisible();
  }

  async openManualOnboarding() {
    await watchPause(this.page);            // see the directory list
    await this.manualOnboardingButton.click();
    await expect(this.page.getByRole('heading', { name: 'Account & Contact Credentials' })).toBeVisible();
    await watchPause(this.page);            // see the empty Step 1 form
  }

  async fillCredentials(d: FleetOwnerData) {
    await typeInto(this.username, d.username);
    await typeInto(this.password, d.password);
    await typeInto(this.contactName, d.contactName);
    await typeInto(this.mobile, d.mobile);
    await typeInto(this.email, d.email);
    await watchPause(this.page);            // see the filled Step 1
    await this.nextStepButton.click();
    await expect(this.page.getByRole('heading', { name: 'Business & Address Profile' })).toBeVisible();
    await watchPause(this.page);            // see the empty Step 2
  }

  async fillBusinessProfile(d: FleetOwnerData) {
    await typeInto(this.businessName, d.businessName);
    await typeInto(this.city, d.city);
    await typeInto(this.state, d.state);
    await typeInto(this.pincode, d.pincode);
    await watchPause(this.page);            // see the filled Step 2
    await this.nextStepButton.click();
    await expect(this.page.getByRole('heading', { name: 'KYC Documents & Settlements' })).toBeVisible();
    await watchPause(this.page);            // see Step 3
  }

  /** Searches the directory and returns the table row for the given text. */
  async searchRow(text: string): Promise<Locator> {
    await this.goto();
    return searchTableRow(this.page, this.page.getByPlaceholder('Search by name, business, or phone…'), text);
  }

  /** Opens a fleet owner's detail page from the directory. */
  async openOwner(businessName: string) {
    await this.goto();
    const row = await this.searchRow(businessName);
    await row.locator('td').nth(1).click();
    await expect(this.page.getByRole('button', { name: 'Edit Details' })).toBeVisible();
    await watchPause(this.page);
  }

  /** Directory rows whose KYC status is "Approved". */
  private approvedRowLocator(): Locator {
    return this.page.locator('tbody tr').filter({ hasText: /Approved/i });
  }

  private async waitForDirectory() {
    await this.goto();
    const rows = this.page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    await expect(rows.first()).not.toContainText(/Loading/i, { timeout: 15000 });
    await expect(this.page.getByText(/Failed to load/i)).toHaveCount(0);
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /**
   * KYC-approved fleet owners on the directory's first page, automation-created
   * ("PW Auto …") owners first. `index` is the position among approved rows.
   */
  async approvedOwners(): Promise<{ index: number; name: string }[]> {
    await this.waitForDirectory();
    const rows = await this.approvedRowLocator().all();
    const owners = await Promise.all(rows.map(async (row, index) => ({
      index,
      name: (await row.locator('td').nth(1).innerText()).split('\n')[0].trim(),
    })));
    const isAuto = (n: string) => /^PW Auto/i.test(n);
    return owners.sort((a, b) => Number(isAuto(b.name)) - Number(isAuto(a.name)));
  }

  /** Opens the detail page of the approved owner at `index` (from approvedOwners()). */
  async openApprovedOwner(index: number) {
    await this.waitForDirectory();
    await this.approvedRowLocator().nth(index).locator('td').nth(1).click();
    await expect(this.page.getByRole('button', { name: 'Edit Details' })).toBeVisible();
    await watchPause(this.page);
  }

  /** Submits the wizard. Returns the API response of the create call. */
  async completeOnboarding() {
    const response = waitForCreateResponse(this.page, /fleet/i);
    await this.completeOnboardingButton.click();
    const result = await response;
    if (result.ok()) {
      await expect(this.page.getByRole('heading', { name: 'Fleet Owner Onboarded!' })).toBeVisible();
    }
    await watchPause(this.page);            // see the success screen
    return result;
  }
}
