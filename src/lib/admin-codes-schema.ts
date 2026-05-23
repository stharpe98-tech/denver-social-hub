// Idempotent migration helper for the admin_codes table.
// Mirrors the shape of other lib/*-schema.ts helpers — safe to call on every
// hit to the admin-login endpoints; D1 will no-op if the table already exists.

export async function ensureAdminCodesSchema(db: D1Database): Promise<void> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_codes (
        email      TEXT NOT NULL,
        code       TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `).run();
    try {
      await db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_admin_codes_lookup ON admin_codes(email, code, used, expires_at)`
      ).run();
    } catch { /* index race — fine */ }
  } catch {
    /* swallow — failure here will surface via the INSERT/SELECT that follows */
  }
}
