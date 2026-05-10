import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { requireApprovedOrg, isSuperAdmin } from '../../../lib/admin-auth';

export const prerender = false;

interface BackupTable { create_sql: string; rows: any[]; }
interface BackupPayload { version: number; tables: Record<string, BackupTable>; }

// Wipes existing user tables and replays the supplied backup. Super-admin
// only because this is destructive: it drops + recreates every table.
//
// Strategy: drop each table from the backup, recreate it from the saved
// CREATE statement, then bulk-insert rows. Tables that exist in the live
// DB but NOT in the backup are left alone (so a partial backup can't
// silently delete data) — pass action=wipe_first to truly start fresh.
export const POST: APIRoute = async (ctx) => {
  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  if (!isSuperAdmin(gate)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });

  let payload: BackupPayload;
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || !payload.tables) {
    return new Response(JSON.stringify({ error: 'invalid_backup' }), { status: 400 });
  }

  const url = new URL(ctx.request.url);
  const wipeFirst = url.searchParams.get('action') === 'wipe_first';
  const tableNames = Object.keys(payload.tables);

  // Belt-and-suspenders confirmation check (the UI also asks).
  const confirm = url.searchParams.get('confirm');
  if (confirm !== 'yes') {
    return new Response(JSON.stringify({ error: 'confirm_required' }), { status: 400 });
  }

  let recreated = 0;
  let inserted = 0;
  const errors: string[] = [];

  if (wipeFirst) {
    const live = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'"
    ).all();
    for (const r of (live.results ?? []) as any[]) {
      try { await db.prepare(`DROP TABLE IF EXISTS "${r.name}"`).run(); } catch (e: any) { errors.push(`drop ${r.name}: ${e.message}`); }
    }
  }

  for (const tableName of tableNames) {
    const t = payload.tables[tableName];
    if (!t || !t.create_sql) continue;

    try {
      await db.prepare(`DROP TABLE IF EXISTS "${tableName}"`).run();
      await db.prepare(t.create_sql).run();
      recreated++;
    } catch (e: any) {
      errors.push(`recreate ${tableName}: ${e.message}`);
      continue;
    }

    if (!t.rows || t.rows.length === 0) continue;

    // Build a single batched insert per table so we don't hammer D1
    // with one statement per row.
    const cols = Object.keys(t.rows[0]);
    if (cols.length === 0) continue;
    const colList = cols.map(c => `"${c}"`).join(',');
    const placeholders = cols.map(() => '?').join(',');
    const stmt = db.prepare(`INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`);
    const batch = t.rows.map(row => stmt.bind(...cols.map(c => row[c] ?? null)));
    try {
      await db.batch(batch);
      inserted += t.rows.length;
    } catch (e: any) {
      errors.push(`insert ${tableName}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify({
    ok: errors.length === 0,
    tables_recreated: recreated,
    rows_inserted: inserted,
    errors,
  }), { headers: { 'Content-Type': 'application/json' } });
};
