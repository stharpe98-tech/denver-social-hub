import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../../../lib/db';
import { ensureEventSyncSchema } from '../../../lib/event-sync/schema';
import { runAllSyncs } from '../../../lib/event-sync';

export const prerender = false;

function isAdmin(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/dsn_user=([^;]+)/);
  if (!m) return false;
  try { return JSON.parse(decodeURIComponent(m[1])).email === 'stharpe98@gmail.com'; } catch { return false; }
}

export async function POST({ request }: APIContext) {
  if (!isAdmin(request)) return json({ error: 'Unauthorized' }, 401);
  const db = getDB();
  if (!db) return json({ error: 'DB unavailable' }, 500);
  await ensureEventSyncSchema(db);

  const body = (await request.json().catch(() => ({}))) as any;
  const action = body.action;

  if (action === 'create') {
    const kind = String(body.kind || '').trim();
    if (kind !== 'discord' && kind !== 'ics') return json({ error: 'kind must be discord or ics' }, 400);
    const label = String(body.label || '').trim().slice(0, 100);
    const config = normalizeConfig(kind, body);
    if (!config) return json({ error: 'missing required config fields' }, 400);
    await db.prepare(
      "INSERT INTO event_sources (kind, label, config, enabled) VALUES (?, ?, ?, 1)"
    ).bind(kind, label, JSON.stringify(config)).run();
    return json({ ok: true });
  }

  if (action === 'update') {
    const id = parseInt(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    const row: any = await db.prepare("SELECT kind FROM event_sources WHERE id = ?").bind(id).first();
    if (!row) return json({ error: 'not found' }, 404);
    const config = normalizeConfig(row.kind, body);
    const label = String(body.label || '').trim().slice(0, 100);
    const enabled = body.enabled ? 1 : 0;
    await db.prepare(
      "UPDATE event_sources SET label = ?, config = ?, enabled = ? WHERE id = ?"
    ).bind(label, config ? JSON.stringify(config) : null, enabled, id).run();
    return json({ ok: true });
  }

  if (action === 'toggle') {
    const id = parseInt(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    await db.prepare("UPDATE event_sources SET enabled = 1 - enabled WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (action === 'delete') {
    const id = parseInt(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    await db.prepare("DELETE FROM event_sources WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (action === 'run') {
    const botToken = (env as any).DISCORD_BOT_TOKEN as string | undefined;
    const result = await runAllSyncs(db, botToken);
    return json({ ok: true, result });
  }

  return json({ error: 'unknown action' }, 400);
}

function normalizeConfig(kind: string, body: any): Record<string, string> | null {
  if (kind === 'discord') {
    const guild_id = String(body.guild_id || '').trim();
    if (!guild_id) return null;
    const out: Record<string, string> = { guild_id };
    const token = String(body.token || '').trim();
    if (token) out.token = token;
    return out;
  }
  if (kind === 'ics') {
    const url = String(body.url || '').trim();
    if (!url) return null;
    return { url };
  }
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
