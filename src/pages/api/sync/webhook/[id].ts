// Inbound webhook for the "webhook" event source kind. Lets Zapier / Make /
// IFTTT / n8n / any script push events without us scheduling a pull.
//
// Usage:
//   POST /api/sync/webhook/<source_id>
//   Authorization: Bearer <webhook_token>      (or ?token=… query param)
//   { "events": [
//       { "external_id":"abc-123", "title":"…",
//         "starts_at":"2026-06-01T19:00:00Z", "location":"…",
//         "url":"…", "description":"…", "event_type":"social" } ] }
//
// Token comes from the row created by /admin/sync. Each source has its own.
import type { APIContext } from 'astro';
import { getDB } from '../../../../lib/db';
import { ensureEventSyncSchema } from '../../../../lib/event-sync/schema';
import { upsertMany, type NormalizedEvent } from '../../../../lib/event-sync/normalize';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request, params, url }: APIContext) {
  const id = parseInt(params.id || '');
  if (!id) return json({ error: 'invalid id' }, 400);

  const db = getDB();
  if (!db) return json({ error: 'DB unavailable' }, 500);
  await ensureEventSyncSchema(db);

  const row: any = await db.prepare("SELECT id, kind, webhook_token, enabled FROM event_sources WHERE id = ?").bind(id).first();
  if (!row) return json({ error: 'not found' }, 404);
  if (row.kind !== 'webhook') return json({ error: 'source is not a webhook' }, 400);
  if (!row.enabled) return json({ error: 'source disabled' }, 403);

  const auth = request.headers.get('authorization') || '';
  const headerToken = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const queryToken = url.searchParams.get('token') || '';
  const presented = headerToken || queryToken;
  if (!presented || presented !== row.webhook_token) return json({ error: 'invalid token' }, 401);

  let payload: any;
  try { payload = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  const list = Array.isArray(payload?.events) ? payload.events
    : Array.isArray(payload) ? payload : null;
  if (!list) return json({ error: 'expected { events: [...] } or [...]' }, 400);

  const normalized: NormalizedEvent[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const externalId = String(e.external_id || e.id || '').trim();
    const title = String(e.title || e.name || '').trim();
    if (!externalId || !title) continue;
    const startsAtRaw = e.starts_at || e.start_time || e.start;
    const startsAt = startsAtRaw ? new Date(String(startsAtRaw)) : null;
    normalized.push({
      source: 'webhook',
      externalId,
      title,
      description: String(e.description || ''),
      startsAt: startsAt && !isNaN(startsAt.getTime()) ? startsAt : null,
      location: String(e.location || ''),
      url: String(e.url || ''),
      eventType: String(e.event_type || 'social'),
      spots: typeof e.spots === 'number' ? e.spots : null,
    });
  }

  const result = await upsertMany(db, normalized);
  await db.prepare(
    "UPDATE event_sources SET last_synced_at = ?, last_status = 'ok', last_error = NULL, last_count = ? WHERE id = ?"
  ).bind(new Date().toISOString(), result.inserted + result.updated, id).run();

  return json({ ok: true, received: list.length, inserted: result.inserted, updated: result.updated });
}
