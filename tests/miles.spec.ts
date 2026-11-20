import { test as loggedOutTest } from '@playwright/test';
import { test, fleetOwnerTest, expect } from '../fixtures/adminTest'; // logged-in tests share ONE browser tab
import { FleetPortalPage, PORTAL_MODULES, PORTAL_KPIS, PORTAL_QUICK_ACTIONS } from '../pages/FleetPortalPage';
import { openModule } from '../utils/navigation';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { FleetOwnersPage } from '../pages/FleetOwnersPage';
import { VehiclesPage } from '../pages/VehiclesPage';
import { StaffPage, DealersPage } from '../pages/AccountsPage';
import { FuelCardsPage, FUEL_TABS, FuelTab } from '../pages/FuelCardsPage';
import { FleetOwnerEditPage } from '../pages/FleetOwnerEditPage';
import { newFleetOwner, newFleetOwnerKyc } from '../test-data/fleetOwner';
import { newVehicle, newStaff, newDealer, newPortalVehicle, newPortalDriver } from '../test-data/accounts';
import { PortalVehiclesPage, PortalDriversPage } from '../pages/PortalFleetPage';
import { ADMIN_USERNAME, ADMIN_PASSWORD, FLEET_OWNER_NAME } from '../utils/credentials';

/**
 * Transight Miles – all functional tests in one file.
 * Each module is a test.describe block. Run one module with:
 *   npx playwright test -g "Fleet Owners"
 *
 * Logged-in tests use `test` from fixtures/adminTest: they all share ONE browser
 * tab (opened from the session saved by tests/auth/auth.setup.ts) and move
 * between modules via the sidebar. This avoids page reloads, which trigger the
 * app's rate-limited token refresh (HTTP 429 → "Failed to load…").
 *
 * The Login block uses `loggedOutTest` (plain Playwright test, fresh tab, no session).
 *
 * ORDER MATTERS: the server allows one session per user, so a fresh admin
 * login ends the saved session. The Login block is therefore kept LAST.
 * New logged-in modules go ABOVE the Login block.
 */

// ═════════════════════════════════════════════════════════════
// DASHBOARD  (logged in)
// ═════════════════════════════════════════════════════════════
test.describe('Dashboard', () => {
  test('shows welcome banner and main menu', async ({ page }) => {
    await openModule(page, 'Dashboard', '/');
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
    for (const item of ['Dashboard', 'Fleet Owners', 'Vehicles', 'Staff', 'Dealers']) {
      await expect(dashboard.menuItem(item)).toBeVisible();
    }
  });
});

// ═════════════════════════════════════════════════════════════
// FLEET OWNERS  (logged in)
// ═════════════════════════════════════════════════════════════
test.describe('Fleet Owners', () => {
  test('directory page shows the fleet owner table', async ({ page }) => {
    const fleetOwners = new FleetOwnersPage(page);
    await fleetOwners.goto();
    await expect(fleetOwners.manualOnboardingButton).toBeVisible();
    for (const col of ['FLEET OWNER DETAILS', 'LOCATION', 'FLEET SIZE', 'KYC STATUS', 'ACCOUNT STATUS']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
  });

  // NOTE: creates a REAL fleet owner on staging each run (prefixed "pwauto_").
  test('admin can create a new fleet owner (manual onboarding)', async ({ page }) => {
    const data = newFleetOwner();
    const fleetOwners = new FleetOwnersPage(page);

    await test.step('Open manual onboarding', async () => {
      await fleetOwners.goto();
      await fleetOwners.openManualOnboarding();
    });

    await test.step('Step 1 – Credentials', () => fleetOwners.fillCredentials(data));

    await test.step('Step 2 – Business profile', () => fleetOwners.fillBusinessProfile(data));

    await test.step('Step 3 – KYC (optional, left empty) and submit', async () => {
      const response = await fleetOwners.completeOnboarding();
      expect(response.status(), 'create API should return 201 Created').toBe(201);
    });

    await test.step('Verify new fleet owner in directory', async () => {
      const row = await fleetOwners.searchRow(data.businessName);
      await expect(row).toContainText(`@${data.username}`);
      await expect(row).toContainText(data.contactName);
      await expect(row).toContainText(data.city);
      await expect(row).toContainText('Pending'); // KYC status
      await expect(row).toContainText('Active');  // account status
    });

    console.log(`Created fleet owner: ${data.username} / ${data.businessName}`);
  });
});

// ═════════════════════════════════════════════════════════════
// VEHICLES  (logged in, Chrome only)
// ═════════════════════════════════════════════════════════════
test.describe('Vehicles', () => {
  test('vehicle directory shows the vehicle table', async ({ page }) => {
    const vehicles = new VehiclesPage(page);
    await vehicles.goto();
    await expect(vehicles.addVehicleButton).toBeVisible();
    await expect(vehicles.searchBox).toBeVisible();
    for (const col of ['REGISTRATION NO.', 'FLEET OWNER', 'VEHICLE TYPE', 'MAKE / MODEL']) {
      await expect(page.getByRole('columnheader', { name: col })).toBeVisible();
    }
  });

  // NOTE: registers a REAL vehicle on staging, linked to a "PW Auto Logistics" test fleet owner.
  test('admin can register a new vehicle', async ({ page }) => {
    const data = newVehicle();
    const vehicles = new VehiclesPage(page);

    await test.step('Open Add Vehicle and select a test fleet owner', async () => {
      await vehicles.goto();
      await vehicles.selectFleetOwner(data.fleetOwnerSearch);
    });

    await test.step('Step 1 – Registration & RC details', async () => {
      const chosen = await vehicles.fillRegistration(data);
      console.log(`Vehicle ${data.registrationNumber}: ${chosen.make} / ${chosen.model} / ${chosen.type} / ${chosen.fuel}`);
    });

    await test.step('Step 2 – Compliance & documents (optional, skipped)', () => vehicles.skipDocuments());

    await test.step('Step 3 – Assets & telematics (optional) and register', async () => {
      const response = await vehicles.register();
      expect(response.ok(), `register API returned ${response.status()}`).toBeTruthy();
    });

    await test.step('Verify vehicle in directory', async () => {
      const row = await vehicles.searchRow(data.registrationNumber);
      await expect(row).toContainText(data.fleetOwnerSearch);
    });
  });
});

// ═════════════════════════════════════════════════════════════
// STAFF  (logged in, Chrome only)
// ═════════════════════════════════════════════════════════════
test.describe('Staff', () => {
  test('staff list shows the staff table', async ({ page }) => {
    const staff = new StaffPage(page);
    await staff.goto();
    await expect(staff.createButton).toBeVisible();
    // Headers are "Name", "Email"… (shown in CAPS by CSS) → match case-insensitively
    for (const col of ['Name', 'Email', 'Modules', 'Status']) {
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}$`, 'i') })).toBeVisible();
    }
  });

  // NOTE: creates a REAL staff login on staging (prefixed "pwauto_staff_").
  test('admin can create a staff member with view-only permission', async ({ page }) => {
    const data = newStaff();
    const staff = new StaffPage(page);

    await test.step('Open Create Staff', async () => {
      await staff.goto();
      await staff.openCreateForm();
    });

    await test.step('Fill details and grant least privilege (Fleet Owners – view)', async () => {
      await staff.fillForm(data);
      await staff.grantPermission('Fleet Owners', 'view');
      await expect(staff.permission('Fleet Owners', 'delete')).not.toBeChecked();
    });

    await test.step('Create', async () => {
      const response = await staff.submit();
      expect(response.ok(), `create staff API returned ${response.status()}`).toBeTruthy();
    });

    await test.step('Verify staff in list', async () => {
      const row = await staff.searchRow(data.email);
      await expect(row).toContainText(data.fullName);
    });

    console.log(`Created staff: ${data.username}`);
  });
});

// ═════════════════════════════════════════════════════════════
// DEALERS  (logged in, Chrome only)
// ═════════════════════════════════════════════════════════════
test.describe('Dealers', () => {
  test('dealer list shows the dealer table', async ({ page }) => {
    const dealers = new DealersPage(page);
    await dealers.goto();
    await expect(dealers.createButton).toBeVisible();
    for (const col of ['Name', 'Email', 'Mobile', 'Status']) {
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}$`, 'i') })).toBeVisible();
    }
  });

  // NOTE: creates a REAL dealer login on staging (prefixed "pwauto_dealer_").
  test('admin can create a dealer', async ({ page }) => {
    const data = newDealer();
    const dealers = new DealersPage(page);

    await test.step('Open Create Dealer', async () => {
      await dealers.goto();
      await dealers.openCreateForm();
    });

    await test.step('Fill dealer details', () => dealers.fillForm(data));

    await test.step('Create', async () => {
      const response = await dealers.submit();
      expect(response.ok(), `create dealer API returned ${response.status()}`).toBeTruthy();
    });

    await test.step('Verify dealer in list', async () => {
      const row = await dealers.searchRow(data.email);
      await expect(row).toContainText(data.fullName);
    });

    console.log(`Created dealer: ${data.username}`);
  });
});

// ═════════════════════════════════════════════════════════════
// FUEL CARDS (IOCL)  (logged in, Chrome only) – READ-ONLY
// "Issue Card" sends a real CreateCard request to IndianOil (IOCL), so these
// tests never submit it: they open the dialog, check it, and cancel.
// ═════════════════════════════════════════════════════════════
test.describe('Fuel Cards', () => {
  test('page shows all four tabs with counts', async ({ page }) => {
    const fuel = new FuelCardsPage(page);
    await fuel.goto();
    for (const tab of Object.keys(FUEL_TABS) as FuelTab[]) {
      await expect(fuel.tab(tab)).toBeVisible();
      expect(await fuel.tabCount(tab), `${tab} count`).toBeGreaterThanOrEqual(0);
    }
    await expect(fuel.searchBox).toBeVisible();
  });

  test('each tab shows its heading and table columns', async ({ page }) => {
    const fuel = new FuelCardsPage(page);
    await fuel.goto();
    for (const [tab, info] of Object.entries(FUEL_TABS) as [FuelTab, (typeof FUEL_TABS)[FuelTab]][]) {
      await test.step(tab, async () => {
        await fuel.openTab(tab);
        for (const col of info.columns) await expect(fuel.column(col)).toBeVisible();
      });
    }
  });

  test('issued cards show only masked card numbers', async ({ page }) => {
    const fuel = new FuelCardsPage(page);
    await fuel.goto();
    await fuel.openTab('Issued Cards');
    test.skip((await fuel.tabCount('Issued Cards')) === 0, 'no issued cards on staging');

    const cardCells = fuel.rows.locator('td:nth-child(3)');
    const count = Math.min(await cardCells.count(), 10);
    for (let i = 0; i < count; i++) {
      const text = (await cardCells.nth(i).innerText()).trim();
      // Must look like "••••••••••••0047" – never a full 16-digit number
      expect(text, `card number in row ${i + 1} must be masked`).toMatch(/^•+\d{4}$/);
    }
  });

  test('failed cards show a failure reason and an "Issue Again" action', async ({ page }) => {
    const fuel = new FuelCardsPage(page);
    await fuel.goto();
    await fuel.openTab('Failed Cards');
    test.skip((await fuel.tabCount('Failed Cards')) === 0, 'no failed cards on staging');

    const firstRow = fuel.rows.first();
    await expect(firstRow).toContainText('Failed');
    await expect(firstRow.locator('td').nth(3)).not.toBeEmpty(); // REASON column
    await expect(firstRow.getByRole('button', { name: 'Issue Again' })).toBeVisible();
  });

  test('search filters requests by fleet owner', async ({ page }) => {
    const fuel = new FuelCardsPage(page);
    await fuel.goto();
    await fuel.openTab('Requested Cards');
    test.skip((await fuel.tabCount('Requested Cards')) === 0, 'no card requests on staging');

    const owner = await fuel.fleetOwnerOf(fuel.rows.first());
    await fuel.search(owner);
    const shown = await fuel.rows.count();
    expect(shown).toBeGreaterThan(0);
    for (let i = 0; i < shown; i++) {
      await expect(fuel.rows.nth(i)).toContainText(owner);
    }
    await fuel.searchBox.clear();
  });

  test('Issue Card dialog warns about IOCL and Cancel sends nothing', async ({ page }) => {
    const fuel = new FuelCardsPage(page);
    await fuel.goto();
    await fuel.openTab('Requested Cards');
    test.skip((await fuel.tabCount('Requested Cards')) === 0, 'no card requests on staging');

    // Record any write request (POST/PUT/PATCH/DELETE) while the dialog is open
    const writes: string[] = [];
    const onRequest = (r: { method(): string; url(): string }) => {
      if (r.method() !== 'GET' && !r.url().includes('/auth/')) writes.push(`${r.method()} ${r.url()}`);
    };
    page.on('request', onRequest);
    try {
      await fuel.openIssueDialog(fuel.rows.first());
      await expect(fuel.issueDialog).toContainText('sent to IndianOil (IOCL CreateCard)');
      await expect(fuel.issueDialog.getByRole('button', { name: 'Issue Card' })).toBeVisible();
      await fuel.cancelIssueDialog();
    } finally {
      page.off('request', onRequest);
    }
    expect(writes, 'opening and cancelling must not send anything to the server').toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════
// FUEL CARD ISSUE – END TO END  (logged in, Chrome only)  @iocl
// Sends REAL requests to IndianOil – staging is connected to the IOCL SANDBOX
// (confirmed by the team). Uses only automation-created data ("PW Auto …").
// Skip it with:  npx playwright test --grep-invert @iocl
// ═════════════════════════════════════════════════════════════
test.describe('Fuel Card Issue (IOCL sandbox)', { tag: '@iocl' }, () => {
  test('issue a fuel card end-to-end for a new fleet owner', async ({ page }) => {
    // Up to 3 IndianOil calls, each can take ~2 minutes
    test.setTimeout(Number(process.env.SLOW_MO) ? 900_000 : 600_000);

    const owner = newFleetOwner();
    const kyc = newFleetOwnerKyc();
    const vehicle = { ...newVehicle(), fleetOwnerSearch: owner.businessName };
    const fleetOwners = new FleetOwnersPage(page);
    const editOwner = new FleetOwnerEditPage(page);
    const vehicles = new VehiclesPage(page);
    const fuel = new FuelCardsPage(page);

    await test.step('1. Create fleet owner', async () => {
      await fleetOwners.goto();
      await fleetOwners.openManualOnboarding();
      await fleetOwners.fillCredentials(owner);
      await fleetOwners.fillBusinessProfile(owner);
      expect((await fleetOwners.completeOnboarding()).status()).toBe(201);
    });

    await test.step('2. Register a vehicle for the fleet owner', async () => {
      await vehicles.goto();
      await vehicles.selectFleetOwner(vehicle.fleetOwnerSearch);
      await vehicles.fillRegistration(vehicle);
      await vehicles.skipDocuments();
      expect((await vehicles.register()).ok()).toBeTruthy();
    });

    await test.step('3. KYC – PAN, bank details, documents', async () => {
      await fleetOwners.openOwner(owner.businessName);
      await editOwner.openEdit();
      await editOwner.fillCompliance(kyc);
    });

    await test.step('4. Approve KYC (unlocks Fuel Account)', () => editOwner.approveKyc());

    await test.step('5. IOCL step 1 – send customer form to IndianOil', async () => {
      await editOwner.openFuelAccountStep();
      await editOwner.sendCustomerForm(kyc.customerFormFile, ADMIN_PASSWORD);
    });

    await test.step('6. IOCL step 2 – create fuel account', async () => {
      const customerId = await editOwner.createFuelAccount(kyc, ADMIN_PASSWORD);
      expect(customerId, 'IndianOil Customer ID').toMatch(/\d{6,}/);
      console.log(`IOCL customer ID for ${owner.businessName}: ${customerId}`);
    });

    await test.step('7. Issue the fuel card', async () => {
      await fuel.goto();
      const response = await fuel.issueCardForOwner(owner.businessName);
      expect(response.ok(), `Issue card returned ${response.status()}`).toBeTruthy();
    });

    await test.step('8. Verify the card under "Issued Cards"', async () => {
      const row = await fuel.issuedRowFor(owner.businessName);
      await expect(row).toContainText('Issued');
      await expect(row.locator('td').nth(2)).toHaveText(/^•+\d{4}$/); // masked card number
    });

    console.log(`Fuel card issued for ${owner.businessName} / vehicle ${vehicle.registrationNumber}`);
  });
});

// ═════════════════════════════════════════════════════════════
// FLEET OWNER PORTAL  (logged in as a fleet owner, not admin)
// Uses `fleetOwnerTest`: its own shared tab + session (.auth/fleetOwner.json).
// Run only these:  npx playwright test --grep "@fleet-owner" --project=chromium
// ═════════════════════════════════════════════════════════════
fleetOwnerTest.describe('Fleet Owner Portal', { tag: '@fleet-owner' }, () => {
  fleetOwnerTest('fleet owner lands on own dashboard with KPIs and quick actions', async ({ page }) => {
    const portal = new FleetPortalPage(page);
    await portal.gotoDashboard();

    await expect(page).toHaveURL(/\/portal$/);
    if (FLEET_OWNER_NAME) await expect(portal.welcome).toContainText(FLEET_OWNER_NAME);
    await expect(page.getByText('Fleet Owner', { exact: true }).first()).toBeVisible();

    for (const kpi of PORTAL_KPIS) {
      await expect(portal.kpi(kpi), `KPI card "${kpi}"`).toBeVisible();
    }
    for (const action of PORTAL_QUICK_ACTIONS) {
      await expect(page.getByRole('button', { name: new RegExp(`^${action}`) }), `Quick action "${action}"`).toBeVisible();
    }
  });

  fleetOwnerTest('sidebar shows fleet owner menu only (no admin modules)', async ({ page }) => {
    const portal = new FleetPortalPage(page);
    await portal.gotoDashboard();
    for (const m of PORTAL_MODULES.filter(m => !m.group)) {
      await expect(portal.menuLink(m.menu), `menu "${m.menu}"`).toBeVisible();
    }
    // Admin-only modules must not be offered to a fleet owner
    for (const adminOnly of ['Fleet Owners', 'Dealers', 'Fuel Cards']) {
      await expect(portal.menuLink(adminOnly), `admin menu "${adminOnly}"`).toHaveCount(0);
    }
  });

  // NOTE: adds a REAL vehicle to the logged-in fleet owner's account on staging.
  fleetOwnerTest('fleet owner can add a vehicle from the dashboard', async ({ page }) => {
    const data = newPortalVehicle();
    const vehicles = new PortalVehiclesPage(page);

    await fleetOwnerTest.step('Dashboard → Add Vehicle', () => vehicles.startFromDashboard());

    await fleetOwnerTest.step('Step 1 – Registration & RC details', async () => {
      const chosen = await vehicles.fillRegistration(data);
      console.log(`Portal vehicle ${data.registrationNumber}: ${chosen.make} / ${chosen.model} / ${chosen.type} / ${chosen.fuel}`);
    });

    await fleetOwnerTest.step('Step 2 – Compliance & documents (optional, skipped)', () => vehicles.skipDocuments());

    await fleetOwnerTest.step('Step 3 – Assets & telematics (optional) and register', async () => {
      const response = await vehicles.register();
      expect(response.ok(), `register API returned ${response.status()}`).toBeTruthy();
    });

    await fleetOwnerTest.step('Verify vehicle in My Vehicles', async () => {
      const row = await vehicles.searchRow(data.registrationNumber);
      await expect(row).toBeVisible();
    });
  });

  // NOTE: adds a REAL driver to the logged-in fleet owner's account on staging.
  fleetOwnerTest('fleet owner can add a driver from the dashboard', async ({ page }) => {
    const data = newPortalDriver();
    const drivers = new PortalDriversPage(page);

    await fleetOwnerTest.step('Dashboard → Add Driver', () => drivers.startFromDashboard());
    await fleetOwnerTest.step('Step 1 – Personal details', () => drivers.fillPersonal(data));
    await fleetOwnerTest.step('Step 2 – Contact & address', () => drivers.fillContact(data));
    await fleetOwnerTest.step('Step 3 – Identity & license (optional, skipped)', () => drivers.skipIdentity());

    await fleetOwnerTest.step('Step 4 – Documents (optional) and register', async () => {
      const response = await drivers.register();
      expect(response.ok(), `register API returned ${response.status()}`).toBeTruthy();
    });

    await fleetOwnerTest.step('Verify driver in Driver Roster', async () => {
      const row = await drivers.searchRow(data.lastName);
      await expect(row).toContainText(data.firstName);
    });
    console.log(`Portal driver created: ${data.firstName} ${data.lastName}`);
  });

  // One test per sidebar page → each shows separately in the report
  for (const m of PORTAL_MODULES) {
    fleetOwnerTest(`opens ${m.menu} page`, async ({ page }) => {
      const portal = new FleetPortalPage(page);
      await portal.open(m);
      for (const col of m.columns ?? []) {
        await expect(portal.column(col).first(), `column "${col}"`).toBeVisible();
      }
    });
  }
});

// ═════════════════════════════════════════════════════════════
// NEXT MODULES – add new describe blocks HERE (above Login)
// ═════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════
// LOGIN  (logged out, runs in Chromium + Firefox + WebKit)
// Kept LAST – see note at top of file.
// ═════════════════════════════════════════════════════════════
loggedOutTest.describe('Login', { tag: '@login' }, () => {
  loggedOutTest.use({ storageState: { cookies: [], origins: [] } });

  let loginPage: LoginPage;

  loggedOutTest.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  loggedOutTest('shows all login page elements', async () => {
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    await expect(loginPage.signInButton).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  loggedOutTest('sign in button is disabled until both fields are filled', async () => {
    await expect(loginPage.signInButton).toBeDisabled();
    await loginPage.usernameInput.fill(ADMIN_USERNAME);
    await expect(loginPage.signInButton).toBeDisabled();
    await loginPage.passwordInput.fill('anything');
    await expect(loginPage.signInButton).toBeEnabled();
  });

  loggedOutTest('show password toggle reveals the password', async () => {
    await loginPage.passwordInput.fill('SomeSecret1');
    await loginPage.showPasswordButton.click();
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
  });

  loggedOutTest('forgot password link opens the reset page', async ({ page }) => {
    await loginPage.forgotPasswordLink.click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  // The server rate-limits sign-in attempts ("Too many sign-in attempts...").
  // Tests that actually submit credentials run in Chromium only to stay under the limit.
  // Uses a non-existent username so the real admin account is never locked out.
  loggedOutTest('invalid credentials show an error and stay on login', async ({ page, browserName }) => {
    loggedOutTest.skip(browserName !== 'chromium', 'login submission runs once (rate limit)');
    await loginPage.login('automation_invalid_user', 'WrongPass#123');
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  loggedOutTest('admin can log in and reach the dashboard', async ({ page, browserName }) => {
    loggedOutTest.skip(browserName !== 'chromium', 'login submission runs once (rate limit)');
    await loginPage.login(ADMIN_USERNAME, ADMIN_PASSWORD);
    await new DashboardPage(page).expectLoaded();
  });
});
