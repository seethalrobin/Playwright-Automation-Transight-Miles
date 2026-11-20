import { Page, Locator, expect } from '@playwright/test';
import { openModule } from '../utils/navigation';
import { watchPause } from '../utils/watch';

/** One sidebar page of the fleet owner portal. */
export interface PortalModule {
  menu: string;        // sidebar link text
  path: string;        // URL it opens (some redirect to a sub-page)
  heading: string;     // main page heading
  columns?: string[];  // table columns, if the page has a table
  group?: string;      // collapsible sidebar group the link sits in
}

/** Sidebar pages of the fleet owner portal (milesstaging, mapped Nov 2026). */
export const PORTAL_MODULES: PortalModule[] = [
  { menu: 'Vehicles',            path: '/portal/vehicles',             heading: 'Fleet Operations & Vehicles',
    columns: ['Registration No.', 'Vehicle Type', 'Make / Model', 'Odometer', 'Insurance', 'Actions'] },
  { menu: 'Drivers',             path: '/portal/drivers',              heading: 'Driver Roster & Payroll',
    columns: ['Driver Profile', 'Assigned Vehicle', 'Wage Structure', 'Pending Wages', 'Actions'] },
  { menu: 'Insurance',           path: '/portal/marketplace/insurance', heading: 'Fleet Insurance Services' },
  { menu: 'Resource Management', path: '/portal/resources',            heading: 'Resource Management' },
  { menu: 'FASTag',              path: '/portal/finance/fastag',       heading: 'FASTag Management', group: 'Cards & Tags' },
  { menu: 'Fuel Card',           path: '/portal/finance/fuel-cards',   heading: 'Fuel Cards (IOCL)', group: 'Cards & Tags',
    columns: ['Vehicle Reg #', 'Make & Model', 'IOCL Card Reference', 'Card Balance', 'Status', 'Actions'] },
  { menu: 'Finance',             path: '/portal/finance',              heading: 'Transactions',
    columns: ['Transaction ID', 'Date & Time', 'Category', 'Amount', 'Status'] },
  { menu: 'Documents',           path: '/portal/documents',            heading: 'Documents & Compliance',
    columns: ['Document Type', 'Asset Owner', 'Expiry Date', 'Compliance Tag', 'Actions'] },
  { menu: 'Reports',             path: '/portal/reports',              heading: 'Reports Center' },
  { menu: 'Staff',               path: '/portal/staff',                heading: 'Staff',
    columns: ['Name', 'Email', 'Mobile', 'Modules', 'Status'] },
  { menu: 'Settings',            path: '/portal/settings',             heading: 'Account Settings' },
];

export const PORTAL_KPIS = ['My Vehicles', 'Active Drivers', 'Active Assignments', 'Documents Expiring'];
export const PORTAL_QUICK_ACTIONS = ['Add Vehicle', 'Add Driver', 'Upload Document'];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Fleet owner portal ("Fleet Portal") – what a fleet owner sees after login. */
export class FleetPortalPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly welcome: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('aside');
    this.welcome = page.getByRole('heading', { name: /^Welcome back,/ });
  }

  menuLink(name: string): Locator {
    return this.sidebar.getByRole('link', { name, exact: true });
  }

  /** Opens the portal home (dashboard). */
  async gotoDashboard() {
    await openModule(this.page, 'Dashboard', '/portal');
    await expect(this.welcome).toBeVisible();
    await watchPause(this.page);
  }

  /** Opens a sidebar page via in-app navigation and checks it rendered. */
  async open(m: PortalModule) {
    if (!this.page.url().includes('/portal')) await this.gotoDashboard();
    if (m.group && !(await this.menuLink(m.menu).isVisible())) {
      await this.sidebar.getByRole('button', { name: m.group }).click(); // expand group
    }
    await openModule(this.page, m.menu, m.path);
    await expect(this.page.getByRole('heading', { name: m.heading, exact: true })).toBeVisible();
    await expect(this.page.getByText(/failed to load/i)).toHaveCount(0);
    await watchPause(this.page);
  }

  /** KPI card on the dashboard, e.g. "My Vehicles". */
  kpi(label: string): Locator {
    return this.page.locator('main').getByText(label, { exact: true });
  }

  /** Header cell (styled in CAPS – match case-insensitively). */
  column(name: string): Locator {
    return this.page.getByRole('columnheader', { name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  }
}
