import { Page, Locator, Response, expect } from '@playwright/test';
import { DriverData, VehicleData } from '../test-data/accounts';
import { FleetPortalPage, PORTAL_MODULES } from './FleetPortalPage';
import { VehiclesPage } from './VehiclesPage';
import { searchTableRow, waitForCreateResponse } from '../utils/table';
import { typeInto, watchPause } from '../utils/watch';

const module = (menu: string) => PORTAL_MODULES.find(m => m.menu === menu)!;

/**
 * Fleet owner adds a vehicle from the portal dashboard ("Add Vehicle" quick action).
 * Same 3-step wizard as the admin one, but the owner is already known (no owner picker).
 */
export class PortalVehiclesPage {
  readonly page: Page;
  readonly portal: FleetPortalPage;
  readonly wizard: VehiclesPage; // reuses the shared wizard steps
  readonly searchBox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.portal = new FleetPortalPage(page);
    this.wizard = new VehiclesPage(page);
    this.searchBox = page.getByPlaceholder('Search Registration...');
  }

  async startFromDashboard() {
    await this.portal.gotoDashboard();
    await this.page.getByRole('button', { name: /^Add Vehicle/ }).click();
    await expect(this.page.getByRole('heading', { name: 'Register New Vehicle' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Registration & RC Details' })).toBeVisible();
    await watchPause(this.page);
  }

  fillRegistration(d: VehicleData) { return this.wizard.fillRegistration(d); }
  skipDocuments() { return this.wizard.skipDocuments(); }
  register(): Promise<Response> { return this.wizard.register(); }

  async searchRow(registration: string): Promise<Locator> {
    await this.portal.open(module('Vehicles'));
    return searchTableRow(this.page, this.searchBox, registration);
  }
}

/** Fleet owner adds a driver from the portal dashboard ("Add Driver" quick action). 4-step wizard. */
export class PortalDriversPage {
  readonly page: Page;
  readonly portal: FleetPortalPage;
  readonly continueButton: Locator;
  readonly searchBox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.portal = new FleetPortalPage(page);
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    this.searchBox = page.getByPlaceholder(/^Search Driver Name or Phone/);
  }

  private async next(stepHeading: string) {
    await watchPause(this.page);
    await this.continueButton.click();
    await expect(this.page.getByRole('heading', { name: stepHeading })).toBeVisible();
    await watchPause(this.page);
  }

  async startFromDashboard() {
    await this.portal.gotoDashboard();
    await this.page.getByRole('button', { name: /^Add Driver/ }).click();
    await expect(this.page.getByRole('heading', { name: 'Register New Driver' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Personal Details' })).toBeVisible();
    await watchPause(this.page);
  }

  /** Step 1 – Personal Details (Driver Type defaults to "Permanent"). */
  async fillPersonal(d: DriverData) {
    await typeInto(this.page.locator('input[name="first_name"]'), d.firstName);
    await typeInto(this.page.locator('input[name="last_name"]'), d.lastName);
    await this.next('Contact & Address');
  }

  /** Step 2 – Contact & Address (only Mobile Number is required). */
  async fillContact(d: DriverData) {
    await typeInto(this.page.locator('#mobile_number'), d.mobile);
    await typeInto(this.page.locator('input[name="city"]'), d.city);
    await typeInto(this.page.locator('input[name="state"]'), d.state);
    await this.next('Identity & License');
  }

  /** Step 3 – Identity & License (optional, skipped). */
  async skipIdentity() {
    await this.next('Documents & KYC Uploads');
  }

  /** Step 4 – Documents (optional for saving) → Register Driver. Returns the create API response. */
  async register(): Promise<Response> {
    const response = waitForCreateResponse(this.page, /driver/i);
    await this.page.getByRole('button', { name: 'Register Driver' }).click();
    const result = await response;
    await watchPause(this.page);
    return result;
  }

  /** Driver search filters on Enter. */
  async searchRow(name: string): Promise<Locator> {
    await this.portal.open(module('Drivers'));
    const row = this.page.locator('tbody tr').filter({ hasText: name });
    await expect(async () => {
      await this.searchBox.clear();
      await typeInto(this.searchBox, name);
      await this.searchBox.press('Enter');
      await expect(row).toHaveCount(1, { timeout: 5000 });
    }).toPass({ timeout: 20000 });
    await watchPause(this.page);
    return row;
  }
}
