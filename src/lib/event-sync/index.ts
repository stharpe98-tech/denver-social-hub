// Sync orchestrator: iterate over enabled `event_sources` rows, call the right
// adapter, upsert into `events`, and record run state on the source row.
// Webhook sources are push-only and skipped here.
import { ensureEventSyncSchema } from './schema';
import { upsertMany, type NormalizedEvent } from './normalize';
import { fetchDiscordEvents } from './discord';
import { fetchIcsEvents } from './ics';
import { fetchEventbriteEvents } from './eventbrite';
import { fetchLumaEvents } from './luma';
import { fetchTicketmasterEvents } from './ticketmaster';
import { fetchFacebookEvents } from './facebook';
import { fetchRssEvents } from './rss';

export interface SyncSourceResult {
  id: number;
  kind: string;
  label: string;
  status: 'ok' | 'error' | 'skipped';
  inserted: number;
  updated: number;
  error?: string;
}

export interface SyncRunResult {
  total: { inserted: number; updated: number; errors: number };
  bySource: SyncSourceResult[];
}

// Run sync for a single source row. Used after create/update so the user
// sees results immediately without waiting for the next cron tick.
export async function runOneSync(
  db: D1Database,
  sourceId: number,
  envBotToken?: string,
): Promise<SyncSourceResult> {
  await ensureEventSyncSchema(db);
  const r: any = await db.prepare(
    "SELECT id, kind, label, config FROM event_sources WHERE id = ?"
  ).bind(sourceId).first();
  if (!r) return { id: sourceId, kind: '', label: '', status: 'error', inserted: 0, updated: 0, error: 'source not found' };
  return await syncOne(db, r, envBotToken);
}

async function syncOne(
  db: D1Database,
  r: any,
  envBotToken: string | undefined,
): Promise<SyncSourceResult> {
  const id = r.id as number;
  const kind = String(r.kind || '');
  const label = String(r.label || '');
  const config = parseConfig(r.config);

  if (kind === 'webhook') {
    return { id, kind, label, status: 'skipped', inserted: 0, updated: 0, error: 'push-only — not pulled on schedule' };
  }

  try {
    let events: NormalizedEvent[];
    switch (kind) {
      case 'discord': events = await fetchDiscordEvents(config, envBotToken); break;
      case 'ics': events = await fetchIcsEvents(config); break;
      case 'eventbrite': events = await fetchEventbriteEvents(config); break;
      case 'luma': events = await fetchLumaEvents(config); break;
      case 'ticketmaster': events = await fetchTicketmasterEvents(config); break;
      case 'facebook': events = await fetchFacebookEvents(config); break;
      case 'rss': events = await fetchRssEvents(config); break;
      default: throw new Error(`unknown source kind: ${kind}`);
    }
    const { inserted, updated } = await upsertMany(db, events);
    await db.prepare(
      "UPDATE event_sources SET last_synced_at = ?, last_status = 'ok', last_error = NULL, last_count = ? WHERE id = ?"
    ).bind(new Date().toISOString(), inserted + updated, id).run();
    return { id, kind, label, status: 'ok', inserted, updated };
  } catch (e: any) {
    const msg = (e?.message || String(e)).slice(0, 500);
    await db.prepare(
      "UPDATE event_sources SET last_synced_at = ?, last_status = 'error', last_error = ? WHERE id = ?"
    ).bind(new Date().toISOString(), msg, id).run();
    return { id, kind, label, status: 'error', inserted: 0, updated: 0, error: msg };
  }
}

function parseConfig(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v as Record<string, string> : {};
  } catch { return {}; }
}

export async function runAllSyncs(db: D1Database, envBotToken?: string): Promise<SyncRunResult> {
  await ensureEventSyncSchema(db);

  const rows = (await db
    .prepare("SELECT id, kind, label, config FROM event_sources WHERE enabled = 1 ORDER BY id ASC")
    .all()).results ?? [];

  const out: SyncRunResult = { total: { inserted: 0, updated: 0, errors: 0 }, bySource: [] };

  for (const r of rows as any[]) {
    const result = await syncOne(db, r, envBotToken);
    out.bySource.push(result);
    if (result.status === 'ok') {
      out.total.inserted += result.inserted;
      out.total.updated += result.updated;
    } else if (result.status === 'error') {
      out.total.errors++;
    }
  }

  return out;
}
