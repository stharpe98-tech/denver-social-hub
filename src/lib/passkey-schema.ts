// Idempotent schema for storing WebAuthn (passkey) credentials. Each row
// represents one authenticator enrolled by an organizer. Key fields are
// stored as base64url strings so we can ship them through JSON without
// fighting Cloudflare Workers' lack of Node Buffer.
export async function ensurePasskeySchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS passkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_id INTEGER NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      device_label TEXT,
      created_at TEXT NOT NULL
    )
  `).run();
}
