import { Page, Locator, expect } from '@playwright/test';
import { FleetOwnerKyc } from '../test-data/fleetOwner';
import { typeInto, watchPause } from '../utils/watch';

/** IndianOil calls can take up to 2 minutes (the app says so) – allow 2.5. */
export const IOCL_TIMEOUT = 150_000;

/**
 * Fleet owner "Edit Details" wizard:
 *   3 Compliance & Banking → 4 Lifecycle & KYC Status → 5 Fuel Account (IOCL)
 * Step 5 only appears once KYC is "Approved".
 * The IOCL steps send data to IndianOil (staging → IOCL sandbox).
 */
export class FleetOwnerEditPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Visible input that follows a label (labels here are not linked with for=). */
  private field(label: string): Locator {
    return this.page.locator(
      `xpath=//main//label[starts-with(normalize-space(.), "${label}")]/following::input[1]`,
    );
  }

  private stepButton(name: RegExp): Locator {
    return this.page.getByRole('button', { name }).first();
  }

  async openEdit() {
    await this.page.getByRole('button', { name: 'Edit Details' }).click();
    await expect(this.page.getByRole('heading', { name: 'Edit Fleet Owner' }).first()).toBeVisible();
  }

  /** Step 3 – PAN, GSTIN, bank details and KYC document uploads. */
  async fillCompliance(k: FleetOwnerKyc) {
    await this.stepButton(/Compliance & Banking/).click();
    const visible = (sel: string) => this.page.locator(`main ${sel}:visible`);
    await typeInto(visible('input[placeholder="ABCDE1234F"]'), k.pan);
    await typeInto(visible('input[placeholder="29ABCDE1234F1Z5"]'), k.gstin);
    await typeInto(this.field('Bank Name'), k.bankName);
    await typeInto(this.field('Account Number'), k.accountNumber);
    await typeInto(visible('input[placeholder="HDFC0001234"]'), k.ifsc);

    const files = this.page.locator('main input[type=file]');
    for (const [i, file] of [k.panCardFile, k.aadhaarCardFile].entries()) {
      const uploaded = this.page.waitForResponse(
        r => r.request().method() === 'POST' && /\/documents$/.test(r.url()) && r.status() !== 401,
      );
      await files.nth(i).setInputFiles(file);
      expect((await uploaded).status(), 'KYC document upload').toBe(201);
    }
    // Badge text is "Uploaded" (shown in CAPS by CSS)
    await expect(this.page.locator('main :visible').getByText(/^uploaded$/i)).toHaveCount(2);
    await watchPause(this.page);
  }

  /** Step 4 – set KYC status to "Approved (active)" and save. Unlocks step 5. */
  async approveKyc() {
    await this.stepButton(/Lifecycle & KYC Status/).click();
    await this.page.locator('main [role=combobox]:visible').last().click();
    await this.page.locator('[class*="-option"]', { hasText: 'Approved (active)' }).click();
    await watchPause(this.page);
    const saved = this.page.waitForResponse(
      r => r.request().method() === 'PATCH' && /\/kyc$/.test(r.url()) && r.status() !== 401,
    );
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
    expect((await saved).status(), 'KYC save').toBe(200);
    await expect(this.page.getByText('KYC: Approved')).toBeVisible();
    await watchPause(this.page);
  }

  async openFuelAccountStep() {
    await this.openEdit();
    await this.stepButton(/Fuel Account \(IOCL\)/).click();
    await expect(this.page.getByText('XTRAPOWER Customer Registration')).toBeVisible();
  }

  /**
   * Where the IOCL setup stands for this fleet owner (call after openFuelAccountStep):
   *   'notStarted' – customer form not sent yet
   *   'formSent'   – IOCL step 1 done, fuel account not created yet
   *   'active'     – fuel account already exists
   */
  async fuelAccountState(): Promise<'notStarted' | 'formSent' | 'active'> {
    const active = this.page.getByText('XTRAPOWER Fuel Account Active');
    const formSent = this.page.getByText('Documents received');
    const notStarted = this.page.getByRole('button', { name: 'Upload to IOCL' });
    await expect(active.or(formSent).or(notStarted).first()).toBeVisible();
    if (await active.isVisible()) return 'active';
    if (await formSent.isVisible()) return 'formSent';
    return 'notStarted';
  }

  /** "IndianOil Customer ID" shown once the fuel account is active. */
  async readCustomerId(): Promise<string> {
    return (await this.page
      .locator('xpath=//*[normalize-space(.)="IndianOil Customer ID"]/following-sibling::*[1]')
      .first()
      .innerText()).trim();
  }

  /** IOCL step 1 – send the customer form (single file) to IndianOil. */
  async sendCustomerForm(file: string, adminPassword: string) {
    await this.page.locator('#iocl-form-file').setInputFiles(file);
    await this.page.getByPlaceholder('Enter your login password').fill(adminPassword); // never typed slowly / logged
    await watchPause(this.page);
    const sent = this.page.waitForResponse(
      r => r.request().method() === 'POST' && /\/iocl\/form-upload$/.test(r.url()) && r.status() !== 401,
      { timeout: IOCL_TIMEOUT },
    );
    await this.page.getByRole('button', { name: 'Upload to IOCL' }).click();
    expect((await sent).status(), 'IOCL form upload').toBe(201);
    await expect(this.page.getByText('Documents received')).toBeVisible();
    await watchPause(this.page);
  }

  /** Picks a date in the app's "Choose date" popover. month is 0-11. */
  private async pickDate(trigger: Locator, d: { day: number; month: number; year: number }) {
    await trigger.click();
    const picker = this.page.getByRole('dialog', { name: 'Choose date' });
    await picker.getByLabel('Year', { exact: true }).selectOption(String(d.year));
    await picker.getByLabel('Month', { exact: true }).selectOption(String(d.month));
    await picker.getByRole('button', { name: String(d.day), exact: true }).first().click();
    await expect(picker).toBeHidden();
  }

  /** IOCL step 2 – open the fuel account (most fields are pre-filled from the profile). */
  async createFuelAccount(k: FleetOwnerKyc, adminPassword: string): Promise<string> {
    // "Try again" replaces "Create Fuel Account" after a failed attempt
    await this.page.getByRole('button', { name: /^(Create Fuel Account|Try again)$/ }).first().click();
    await expect(this.page.getByText('CUSTOMER DETAILS')).toBeVisible();

    await typeInto(this.field('Address Line 1'), k.addressLine1);
    await this.pickDate(this.page.getByRole('button', { name: 'dd mmm yyyy' }), k.incorporationDate);
    await this.page.getByPlaceholder('Enter your login password').fill(adminPassword);
    await watchPause(this.page);

    const created = this.page.waitForResponse(
      r => r.request().method() === 'POST' && /\/iocl\//.test(r.url()) && !/form-upload/.test(r.url()) && r.status() !== 401,
      { timeout: IOCL_TIMEOUT }, // "IndianOil can take up to 2 minutes to respond"
    );
    await this.page.getByRole('button', { name: 'Create Fuel Account' }).last().click();
    const response = await created;
    expect(response.ok(), `IOCL create account returned ${response.status()}: ${await response.text().catch(() => '')}`).toBeTruthy();

    await expect(this.page.getByText('XTRAPOWER Fuel Account Active')).toBeVisible({ timeout: 30000 });
    const customerId = await this.readCustomerId();
    await watchPause(this.page);
    return customerId;
  }
}
