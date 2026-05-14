// Sync orchestrator: iterate over enabled `event_sources` rows, call the right
// adapter, upsert into `events`, and record run state on the source row.
import { ensureEventSyncSchema } from './schema';
import { upsertMany, type NormalizedEvent } from './normalize';
import { fetchDiscordEvents } from './discord';
import { fetchIcsEvents } from './ics';

export interface SyncRunResult {
  total: { inserted: number; updated: number; errors: number };
  bySource: Array<{ id: number; kind: string; label: string; status: 'ok' | 'error'; inserted: number; updated: number; error?: string }>;
}

export async function runAllSyncs(db: D1Database, envBotToken?: string): Promise<SyncRunResult> {
  await ensureEventSyncSchema(db);

  const rows = (await db
    .prepare("SELECT id, kind, label, config FROM event_sources WHERE enabled = 1 ORDER BY id ASC")
    .all()).results ?? [];

  const out: SyncRunResult = { total: { inserted: 0, updated: 0, errors: 0 }, bySource: [] };

  for (const r of rows as any[]) {
    const id = r.id as number;
    const kind = String(r.kind || '');
    const label = String(r.label || '');
    try {
      let events: NormalizedEvent[];
      if (kind === 'discord') events = await fetchDiscordEvents(r.config, envBotToken);
      else if (kind === 'ics') events = await fetchIcsEvents(r.config);
      else throw new Error(`unknown source kind: ${kind}`);

      const { inserted, updated } = await upsertMany(db, events);
      out.total.inserted += inserted;
      out.total.updated += updated;
      out.bySource.push({ id, kind, label, status: 'ok', inserted, updated });

      await db.prepare(
        "UPDATE event_sources SET last_synced_at = ?, last_status = 'ok', last_error = NULL, last_count = ? WHERE id = ?"
      ).bind(new Date().toISOString(), inserted + updated, id).run();
    } catch (e: any) {
      const msg = (e?.message || String(e)).slice(0, 500);
      out.total.errors++;
      out.bySource.push({ id, kind, label, status: 'error', inserted: 0, updated: 0, error: msg });
      await db.prepare(
        "UPDATE event_sources SET last_synced_at = ?, last_status = 'error', last_error = ? WHERE id = ?"
      ).bind(new Date().toISOString(), msg, id).run();
    }
  }

  return out;
}
