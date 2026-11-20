import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly breadcrumb: Locator;
  readonly welcomeHeading: Locator;
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.breadcrumb = page.getByText('Admin Console');
    this.welcomeHeading = page.getByRole('heading', { name: /Welcome back, Transight Admin/ });
    this.sidebar = page.getByRole('complementary').or(page.locator('aside, nav')).first();
  }

  async expectLoaded() {
    await expect(this.page).not.toHaveURL(/\/login/);
    await expect(this.welcomeHeading).toBeVisible();
  }

  menuItem(name: string): Locator {
    return this.page.getByRole('link', { name, exact: true })
      .or(this.page.getByRole('button', { name, exact: true }))
      .first();
  }
}
