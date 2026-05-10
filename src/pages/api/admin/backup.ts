import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { requireApprovedOrg, isSuperAdmin } from '../../../lib/admin-auth';

export const prerender = false;

// Full D1 dump as a JSON download. Includes every user-created table
// (sqlite_* internals are skipped) along with each table's CREATE
// statement so the restore endpoint can rebuild from scratch.
//
// Super-admin only — the dump contains hashed passwords, PIN hashes,
// passkey credentials, magic tokens, and config secrets. Treat the
// resulting file like a vault.
export const GET: APIRoute = async (ctx) => {
  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  if (!isSuperAdmin(gate)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });

  const tables = await db.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name"
  ).all();

  const dump: Record<string, { create_sql: string; rows: any[] }> = {};
  for (const t of (tables.results ?? []) as any[]) {
    if (!t.sql) continue;
    const data = await db.prepare(`SELECT * FROM "${t.name}"`).all();
    dump[t.name] = {
      create_sql: t.sql,
      rows: data.results ?? [],
    };
  }

  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    database: 'denver-social',
    tables: dump,
  };

  const filename = `denver-social-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
