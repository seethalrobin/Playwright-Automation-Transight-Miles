# Transight Miles – Playwright Automation

End-to-end UI tests for the **Transight Miles** fleet/fuel-card web app, written in TypeScript with [Playwright](https://playwright.dev) using the Page Object Model.

## Coverage

| Module | Notes |
|---|---|
| Login | Runs on Chromium, Firefox and WebKit (`@login` tag) |
| Dashboard | |
| Fleet Owners | Create, edit, KYC / customer form, fuel account |
| Vehicles | |
| Staff / Dealers | Account creation |
| Fuel Cards | Including IOCL sandbox card issue |
| Fleet Owner portal | Logged in as a fleet owner |

## Project structure

```
pages/        Page Objects (one class per screen)
tests/        Specs – auth/auth.setup.ts logs in once; miles.spec.ts holds all modules
fixtures/     Custom fixtures (shared logged-in admin tab)
utils/        Credentials loader, navigation, table and watch-mode helpers
test-data/    Generated test data + dummy upload files (PDFs)
.github/      GitHub Actions CI workflow
```

## Setup

Requires Node.js 18+.

```bash
npm ci
npx playwright install
cp .env.example .env    # then fill in the values
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `BASE_URL` | no | App URL (defaults to staging) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | yes | Admin login |
| `FLEET_OWNER_USERNAME` / `FLEET_OWNER_PASSWORD` | yes | Fleet owner portal login |
| `FLEET_OWNER_NAME` | no | Name expected in "Welcome back, …" |

> **Never commit `.env` or `.auth/`** — they hold credentials and live session cookies. Both are git-ignored.

## Running tests

```bash
npm test                              # all projects
npx playwright test -g "Fleet Owners" # one module
npm run test:ui                       # interactive UI mode
npm run report                        # open the last HTML report
```

**Watch mode** (slow-motion, headed, records video) – PowerShell:

```powershell
$env:SLOW_MO=1000; npx playwright test --headed --workers=1 --project=chromium
```

### How the run is ordered

1. `setup` logs in once and saves the session to `.auth/`.
2. `chromium` runs the logged-in modules in **one shared tab** (avoids reloads that hit the app's rate-limited token refresh).
3. `chromium-login` runs the login tests **last** — the server allows one session per user, so a fresh login would kick out the shared tab.
4. `firefox` / `webkit` run only the `@login` tests.

## CI

`.github/workflows/playwright.yml` runs on push/PR to `main`. Add these as **repository secrets** (Settings → Secrets and variables → Actions):
`BASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `FLEET_OWNER_USERNAME`, `FLEET_OWNER_PASSWORD`, `FLEET_OWNER_NAME`.

The HTML report is uploaded as a build artifact (30-day retention).

## Test data notes

- Created records are prefixed `pwauto_` so they are easy to find and clean up on staging.
- Mobile numbers use the `9000xxxxxx` range and emails use `@example.com`, so no real person is contacted.
- Files in `test-data/files/` are dummy documents — never put real Aadhaar/PAN scans there.
