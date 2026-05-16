import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../../../lib/db';
import { ensureEventSyncSchema } from '../../../lib/event-sync/schema';
import { runAllSyncs, runOneSync } from '../../../lib/event-sync';
import { findKind, buildConfigFromBody } from '../../../lib/event-sync/kinds';
import { isAdmin } from '../../../lib/admin-auth';

export const prerender = false;

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request, cookies }: APIContext) {
  if (!(await isAdmin(cookies))) return json({ error: 'Unauthorized' }, 401);
  const db = getDB();
  if (!db) return json({ error: 'DB unavailable' }, 500);
  await ensureEventSyncSchema(db);

  const body = (await request.json().catch(() => ({}))) as any;
  const action = body.action;

  if (action === 'create') {
    const kind = String(body.kind || '').trim();
    const kindDef = findKind(kind);
    if (!kindDef) return json({ error: `unknown kind: ${kind}` }, 400);
    const label = String(body.label || '').trim().slice(0, 100);

    const { config, error } = buildConfigFromBody(kindDef, body);
    if (error) return json({ error }, 400);

    const webhookToken = kind === 'webhook' ? generateToken() : null;
    const insert = await db.prepare(
      "INSERT INTO event_sources (kind, label, config, webhook_token, enabled) VALUES (?, ?, ?, ?, 1)"
    ).bind(kind, label, JSON.stringify(config || {}), webhookToken).run();

    const newId = Number((insert as any).meta?.last_row_id) || 0;
    let sync: any = null;
    if (kind !== 'webhook' && newId) {
      const botToken = (env as any).DISCORD_BOT_TOKEN as string | undefined;
      sync = await runOneSync(db, newId, botToken);
    }
    return json({ ok: true, id: newId, sync });
  }

  if (action === 'update') {
    const id = parseInt(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    const row: any = await db.prepare("SELECT kind FROM event_sources WHERE id = ?").bind(id).first();
    if (!row) return json({ error: 'not found' }, 404);
    const kindDef = findKind(row.kind);
    if (!kindDef) return json({ error: `unknown kind in DB: ${row.kind}` }, 500);
    const label = String(body.label || '').trim().slice(0, 100);
    const enabled = body.enabled ? 1 : 0;
    const { config, error } = buildConfigFromBody(kindDef, body);
    if (error) return json({ error }, 400);
    await db.prepare(
      "UPDATE event_sources SET label = ?, config = ?, enabled = ? WHERE id = ?"
    ).bind(label, JSON.stringify(config || {}), enabled, id).run();

    let sync: any = null;
    if (enabled && row.kind !== 'webhook') {
      const botToken = (env as any).DISCORD_BOT_TOKEN as string | undefined;
      sync = await runOneSync(db, id, botToken);
    }
    return json({ ok: true, sync });
  }

  if (action === 'toggle') {
    const id = parseInt(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    await db.prepare("UPDATE event_sources SET enabled = 1 - enabled WHERE id = ?").bind(id).run();
    // If we just enabled it, sync right away so the user doesn't wait for cron.
    const row: any = await db.prepare("SELECT kind, enabled FROM event_sources WHERE id = ?").bind(id).first();
    let sync: any = null;
    if (row?.enabled && row.kind !== 'webhook') {
      const botToken = (env as any).DISCORD_BOT_TOKEN as string | undefined;
      sync = await runOneSync(db, id, botToken);
    }
    return json({ ok: true, sync });
  }

  if (action === 'rotate_token') {
    const id = parseInt(body.id);
    if (!id) return json({ error: 'missing id' }, 400);
    const row: any = await db.prepare("SELECT kind FROM event_sources WHERE id = ?").bind(id).first();
    if (!row) return json({ error: 'not found' }, 404);
    if (row.kind !== 'webhook') return json({ error: 'not a webhook source' }, 400);
    const token = generateToken();
    await db.prepare("UPDATE event_sources SET webhook_token = ? WHERE id = ?").bind(token, id).run();
    return json({ ok: true, token });
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
