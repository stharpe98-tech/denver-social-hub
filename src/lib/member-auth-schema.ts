// Schema helpers for member auth (Discord OAuth + email magic codes).
// Idempotent — safe to call on every request.

export async function ensureMemberAuthSchema(db: D1Database): Promise<void> {
  // members table — add Discord columns if missing
  const memberCols = await db.prepare("PRAGMA table_info(members)").all();
  const memberNames = new Set((memberCols.results ?? []).map((r: any) => r.name));
  if (!memberNames.has('discord_id')) {
    await db.prepare("ALTER TABLE members ADD COLUMN discord_id TEXT").run();
  }
  if (!memberNames.has('discord_username')) {
    await db.prepare("ALTER TABLE members ADD COLUMN discord_username TEXT").run();
  }
  if (!memberNames.has('avatar_url')) {
    await db.prepare("ALTER TABLE members ADD COLUMN avatar_url TEXT").run();
  }

  // Separate magic-token table for members so member + admin OTP
  // requests never collide on the shared admin magic_tokens table.
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS member_magic_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();
}

// One-line helper for endpoints to read the live Resend config out of
// the same `config` table the rest of the app uses.
export async function getResendConfig(db: D1Database): Promise<{ apiKey: string; from: string } | null> {
  const rows = await db.prepare("SELECT key, value FROM config WHERE key IN ('resend_api_key','from_email')").all();
  const cfg: Record<string, string> = {};
  (rows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
  if (!cfg.resend_api_key) return null;
  return { apiKey: cfg.resend_api_key, from: cfg.from_email || 'Denver Social <onboarding@resend.dev>' };
}
