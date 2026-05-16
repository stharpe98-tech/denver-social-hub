import type { APIContext } from 'astro';
import { getDB } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin-auth';

export const prerender = false;

// GET - load all settings
export async function GET({ request, cookies }: APIContext) {
  if (!(await isAdmin(cookies))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  void request;
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });
  try {
    // Ensure table exists
    await db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
    const rows = (await db.prepare(`SELECT key, value FROM settings`).all())?.results || [];
    const settings: Record<string, string> = {};
    for (const r of rows as any[]) { settings[r.key] = r.value; }
    return new Response(JSON.stringify(settings));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// POST - save settings (batch upsert)
export async function POST({ request, cookies }: APIContext) {
  if (!(await isAdmin(cookies))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
    const body = await request.json() as Record<string, any>;
    const stmts = Object.entries(body).map(([key, value]) =>
      db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(key, String(value))
    );
    if (stmts.length > 0) await db.batch(stmts);
    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
