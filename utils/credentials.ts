// Credentials come ONLY from environment variables (.env locally, GitHub Actions secrets in CI).
// Never hardcode real usernames/passwords here – this file is committed to git.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}. Copy .env.example to .env and fill it in (or set it as a CI secret).`);
  }
  return value;
}

export const ADMIN_USERNAME = required('ADMIN_USERNAME');
export const ADMIN_PASSWORD = required('ADMIN_PASSWORD');

export const ADMIN_STORAGE_STATE = '.auth/admin.json';

// Fleet owner portal login.
export const FLEET_OWNER_USERNAME = required('FLEET_OWNER_USERNAME');
export const FLEET_OWNER_PASSWORD = required('FLEET_OWNER_PASSWORD');
// Name shown in "Welcome back, <name>". Optional – the check is skipped if empty.
export const FLEET_OWNER_NAME = process.env.FLEET_OWNER_NAME || '';

export const FLEET_OWNER_STORAGE_STATE = '.auth/fleetOwner.json';
