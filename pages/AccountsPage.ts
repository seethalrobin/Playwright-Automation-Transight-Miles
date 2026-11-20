import { Page, Locator, Response, expect } from '@playwright/test';
import { AccountData } from '../test-data/accounts';
import { typeInto, watchPause } from '../utils/watch';
import { searchTableRow, waitForCreateResponse } from '../utils/table';
import { openModule } from '../utils/navigation';

/**
 * Staff and Dealers share the same list + "Create" modal layout,
 * so both page objects extend this base class.
 */
export class AccountsPage {
  readonly page: Page;
  readonly path: string;
  readonly menuName: string;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly searchBox: Locator;
  readonly dialog: Locator;
  readonly username: Locator;
  readonly fullName: Locator;
  readonly email: Locator;
  readonly mobile: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;

  constructor(page: Page, opts: { path: string; heading: string; createLabel: string }) {
    this.page = page;
    this.path = opts.path;
    this.menuName = opts.heading; // sidebar link text = page heading ("Staff", "Dealers")
    this.heading = page.getByRole('heading', { name: opts.heading, exact: true });
    this.createButton = page.getByRole('button', { name: new RegExp(opts.createLabel) });
    this.searchBox = page.getByPlaceholder('Search by name, username, or email…');
    this.dialog = page.getByRole('dialog');
    this.username = this.dialog.locator('#staff-username');
    this.fullName = this.dialog.locator('#staff-name');
    this.email = this.dialog.locator('#staff-email');
    this.mobile = this.dialog.locator('#staff-mobile');
    this.password = this.dialog.locator('#staff-password');
    this.submitButton = this.dialog.getByRole('button', { name: opts.createLabel, exact: true });
  }

  async goto() {
    await openModule(this.page, this.menuName, this.path);
    await expect(this.heading).toBeVisible();
  }

  async openCreateForm() {
    await watchPause(this.page);
    await this.createButton.click();
    await expect(this.dialog).toBeVisible();
    await watchPause(this.page);
  }

  async fillForm(d: AccountData) {
    await typeInto(this.username, d.username);
    await typeInto(this.fullName, d.fullName);
    await typeInto(this.email, d.email);
    await typeInto(this.password, d.password);
  }

  /**
   * Clicks Create and returns the create API response.
   * The form validates asynchronously (e.g. username availability), and a click
   * that lands during that check is ignored. So: click, and if no create request
   * was sent within 3 s, click again. Re-clicks only happen while NO request has
   * been sent yet, so this can never create a duplicate record.
   */
  async submit(): Promise<Response> {
    await watchPause(this.page);
    let sent = false;
    const onRequest = (r: { method(): string; url(): string }) => {
      if (r.method() === 'POST' && !r.url().includes('/auth/')) sent = true;
    };
    this.page.on('request', onRequest);
    const response = waitForCreateResponse(this.page, /./);
    try {
      for (let attempt = 0; attempt < 4 && !sent; attempt++) {
        await expect(this.submitButton).toBeEnabled();
        await this.submitButton.click();
        await this.page.waitForTimeout(3000);
      }
      const result = await response;
      await watchPause(this.page);
      return result;
    } finally {
      this.page.off('request', onRequest);
    }
  }

  /** Searches the list. The list refreshes itself after Create, so no navigation needed. */
  async searchRow(text: string): Promise<Locator> {
    await expect(this.dialog).toBeHidden();
    await expect(this.heading).toBeVisible();
    return searchTableRow(this.page, this.searchBox, text);
  }
}

export class StaffPage extends AccountsPage {
  constructor(page: Page) {
    super(page, { path: '/staff', heading: 'Staff', createLabel: 'Create Staff' });
  }

  /** One permission checkbox, e.g. permission('Fleet Owners', 'view'). */
  permission(module: string, action: 'view' | 'create' | 'edit' | 'delete'): Locator {
    return this.dialog.getByRole('checkbox', { name: `${module} — ${action}` });
  }

  /**
   * Ticks a permission and makes sure it stays ticked. The form can re-render
   * while it updates and drop the first click, so retry until it sticks.
   */
  async grantPermission(module: string, action: 'view' | 'create' | 'edit' | 'delete') {
    const box = this.permission(module, action);
    await expect(async () => {
      if (!(await box.isChecked())) await box.click();
      await expect(box).toBeChecked({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await watchPause(this.page);
  }
}

export class DealersPage extends AccountsPage {
  constructor(page: Page) {
    super(page, { path: '/dealers', heading: 'Dealers', createLabel: 'Create Dealer' });
  }
}
