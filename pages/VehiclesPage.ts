import { Page, Locator, Response, expect } from '@playwright/test';
import { VehicleData } from '../test-data/accounts';
import { typeInto, watchPause } from '../utils/watch';
import { searchTableRow, waitForCreateResponse } from '../utils/table';
import { openModule } from '../utils/navigation';

export class VehiclesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addVehicleButton: Locator;
  readonly searchBox: Locator;
  readonly registrationNumber: Locator;
  readonly continueButton: Locator;
  readonly registerButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Vehicle Directory' });
    this.addVehicleButton = page.getByRole('button', { name: 'Add Vehicle' });
    this.searchBox = page.getByPlaceholder('Search Registration or Fleet Owner...');
    this.registrationNumber = page.locator('input[name="registration_number"]');
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    this.registerButton = page.getByRole('button', { name: 'Register Vehicle' });
  }

  async goto() {
    await openModule(this.page, 'Vehicles', '/vehicles');
    await expect(this.heading).toBeVisible();
  }

  /** react-select dropdown that follows a given label. */
  private dropdown(label: string): Locator {
    return this.page.locator('main').locator(
      `xpath=.//label[contains(normalize-space(.), "${label}")]/following::input[@role="combobox"][1]`,
    );
  }

  private options(): Locator {
    return this.page.locator('[class*="-option"]');
  }

  /** Opens a dropdown and picks the first option (or the one matching `text`). Returns the chosen text. */
  async chooseOption(label: string, text?: string): Promise<string> {
    const box = this.dropdown(label);
    await box.click();
    if (text) await typeInto(box, text);
    const option = this.options().first();
    await expect(option).toBeVisible();
    const chosen = (await option.innerText()).trim();
    await option.click();
    return chosen;
  }

  async selectFleetOwner(search: string) {
    await watchPause(this.page);
    await this.addVehicleButton.click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Select Fleet Owner' })).toBeVisible();
    await typeInto(dialog.getByRole('combobox'), search);
    await expect(this.options().first()).toBeVisible();
    await watchPause(this.page);
    await this.options().first().click();
    await this.page.waitForURL(/\/vehicles\/new\?fleet_owner_id=/);
    await expect(this.page.getByRole('heading', { name: 'Registration & RC Details' })).toBeVisible();
    await watchPause(this.page);
  }

  /** Step 1 – Registration & RC details. Returns the chosen make/model/type/fuel. */
  async fillRegistration(d: VehicleData) {
    await typeInto(this.registrationNumber, d.registrationNumber);
    const make = await this.chooseOption('Make', d.make);
    const model = await this.chooseOption('Model');       // enabled only after Make
    const type = await this.chooseOption('Vehicle Type');
    const fuel = await this.chooseOption('Fuel Type');
    await watchPause(this.page);
    await this.continueButton.click();
    await expect(this.page.getByRole('heading', { name: 'Compliance & Documents' })).toBeVisible();
    await watchPause(this.page);
    return { make, model, type, fuel };
  }

  /** Step 2 – Compliance & Documents (optional, skipped). */
  async skipDocuments() {
    await this.continueButton.click();
    await expect(this.page.getByRole('heading', { name: /Assets & Telematics/ })).toBeVisible();
    await watchPause(this.page);
  }

  /** Step 3 – Assets & Telematics (optional) → Register Vehicle. Returns the create API response. */
  async register(): Promise<Response> {
    const response = waitForCreateResponse(this.page, /vehicle/i);
    await this.registerButton.click();
    const result = await response;
    await watchPause(this.page);
    return result;
  }

  async searchRow(text: string): Promise<Locator> {
    await this.goto();
    return searchTableRow(this.page, this.searchBox, text);
  }
}
