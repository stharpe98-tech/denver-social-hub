// Schema for the trusted-device PIN flow.
//
// Each row represents one browser/device that has been "trusted" by an
// organizer after a real login (password / passkey / OTP). The browser
// stores the raw device_token in an HttpOnly cookie; we only persist the
// SHA-256 hash so a DB leak doesn't compromise the cookie. A PIN is
// stored as SHA-256(salt + pepper + pin) where salt is per-device.
//
// We delete the row outright on 5 failed attempts (rather than locking
// it) so a legitimate user just re-enrolls from a real login.
export async function ensureTrustedDeviceSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS trusted_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_id INTEGER NOT NULL,
      device_token_hash TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      device_label TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    )
  `).run();
}

// Cookie name for the device token. The token itself is opaque random
// bytes — never expose it client-side.
export const DEVICE_COOKIE = 'dsn_pin_dev';
export const DEVICE_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year
export const MAX_FAILED_ATTEMPTS = 5;
const PIN_PEPPER = 'dsn-pin-pepper-2026';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generatePinSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashDeviceToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return sha256Hex(salt + PIN_PEPPER + pin);
}
