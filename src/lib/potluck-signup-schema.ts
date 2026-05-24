// Idempotent migration helper for the multi-slot potluck signup model.
// Adds signup_token + is_primary to potluck_rsvp so one person can claim
// multiple dishes under a single token (anchored client-side in
// localStorage) without an account.
//
// Mirrors lib/profile-theme-schema.ts: PRAGMA check, then ALTER inside
// try/catch so re-runs are no-ops on D1.

export async function ensurePotluckSignupSchema(db: D1Database): Promise<void> {
  try {
    const cols = await db.prepare("PRAGMA table_info(potluck_rsvp)").all();
    const names = new Set((cols.results ?? []).map((r: any) => r.name));
    if (!names.has('signup_token')) {
      try {
        await db.prepare("ALTER TABLE potluck_rsvp ADD COLUMN signup_token TEXT DEFAULT ''").run();
      } catch { /* idempotent — swallow duplicate-column races */ }
    }
    if (!names.has('is_primary')) {
      try {
        await db.prepare("ALTER TABLE potluck_rsvp ADD COLUMN is_primary INTEGER DEFAULT 1").run();
      } catch { /* idempotent */ }
    }
  } catch {
    // PRAGMA failed; potluck_rsvp likely missing — not this helper's problem.
  }
  try {
    await db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_potluck_rsvp_token ON potluck_rsvp(potluck_id, signup_token)"
    ).run();
  } catch { /* idempotent */ }

  // Backfill: legacy rows (pre-token schema) have signup_token = '' or NULL.
  // Give each such row its own fresh unique token so:
  //   1. No existing signup is lost (UPDATE only, never DELETE).
  //   2. Legacy signups can't be hijacked via the new edit UI — the token
  //      is never exposed to anyone, so they remain effectively read-only
  //      single-item signups (which matches their original semantics).
  //   3. is_primary already defaults to 1, which is correct for legacy
  //      single-row signups.
  // Idempotent: only touches rows where signup_token IS NULL or ''. Rows
  // that already have a token (new signups) are never updated.
  try {
    const legacy = await db.prepare(
      "SELECT id FROM potluck_rsvp WHERE signup_token IS NULL OR signup_token = ''"
    ).all();
    const rows = (legacy.results ?? []) as Array<{ id: number }>;
    for (const row of rows) {
      const token = generateSignupToken();
      try {
        await db.prepare(
          "UPDATE potluck_rsvp SET signup_token=? WHERE id=? AND (signup_token IS NULL OR signup_token='')"
        ).bind(token, row.id).run();
      } catch { /* per-row best effort; never delete */ }
    }
  } catch { /* backfill best effort — never blocks schema setup */ }
}

export function generateSignupToken(): string {
  // 24-char URL-safe token. Used as the sole auth handle for a signup.
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '').slice(0, 24);
}
