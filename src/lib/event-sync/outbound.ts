// Outbound mirror: when a site event is created/updated/deleted, push the
// change to any Discord source that has mirror_enabled. Uses the same bot
// token as the inbound pull adapter.
//
// Discord docs:
//   POST   /guilds/{guild.id}/scheduled-events    — create scheduled event
//   PATCH  /guilds/{guild.id}/scheduled-events/{event.id} — update
//   DELETE /guilds/{guild.id}/scheduled-events/{event.id} — delete
//   POST   /channels/{channel.id}/messages        — post announcement
//
// We only mirror "EXTERNAL" entity_type events (location-based) since site
// events have free-text locations, not Discord channels.
import { ensureEventSyncSchema } from './schema';

const MONTH_INDEX: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

interface DiscordSourceConfig {
  guild_id: string;
  token?: string;
  mirror_enabled?: string;
  announce_channel_id?: string;
}

interface SiteEvent {
  id: number;
  title: string;
  description?: string | null;
  event_month?: string | null;
  event_day?: string | null;
  location?: string | null;
  zone?: string | null;
  external_source?: string | null;
  discord_mirror_event_id?: string | null;
  discord_mirror_message_id?: string | null;
  discord_mirror_guild_id?: string | null;
}

function authHeader(token: string): string {
  return token.toLowerCase().startsWith('bot ') ? token : `Bot ${token}`;
}

function siteUrl(): string {
  return 'https://denversocialhub.com';
}

// Best-effort: turn the site's "MAY" + "15" + current year into an ISO start.
// If anything's missing, returns null and we skip the mirror.
function buildStart(ev: SiteEvent): Date | null {
  const month = (ev.event_month || '').toUpperCase();
  const day = parseInt(ev.event_day || '');
  const mi = MONTH_INDEX[month];
  if (mi === undefined || !day || isNaN(day)) return null;
  const now = new Date();
  let year = now.getUTCFullYear();
  // If the date already passed this year, roll to next.
  const candidate = new Date(Date.UTC(year, mi, day, 19, 0, 0)); // 7pm UTC default
  if (candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    year += 1;
  }
  return new Date(Date.UTC(year, mi, day, 19, 0, 0));
}

async function discord<T = any>(
  method: string, path: string, token: string, body?: any
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      Authorization: authHeader(token),
      'Content-Type': 'application/json',
      'User-Agent': 'DenverSocialHub-Sync/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = data?.message ? `${res.status}: ${data.message}` : `${res.status}`;
    return { ok: false, status: res.status, data: null, error: msg };
  }
  return { ok: true, status: res.status, data };
}

async function listMirrorSources(db: D1Database): Promise<Array<{ id: number; config: DiscordSourceConfig }>> {
  await ensureEventSyncSchema(db);
  const rows = (await db.prepare(
    "SELECT id, config FROM event_sources WHERE kind = 'discord' AND enabled = 1"
  ).all()).results ?? [];
  const out: Array<{ id: number; config: DiscordSourceConfig }> = [];
  for (const r of rows as any[]) {
    let cfg: DiscordSourceConfig | null = null;
    try { cfg = r.config ? JSON.parse(r.config) : null; } catch {}
    if (!cfg?.guild_id) continue;
    if (!cfg.mirror_enabled) continue;
    out.push({ id: r.id, config: cfg });
  }
  return out;
}

function resolveToken(cfg: DiscordSourceConfig, envBotToken: string | undefined): string | null {
  const t = (cfg.token || envBotToken || '').trim();
  return t || null;
}

// Build the Discord API body for a scheduled-event create or update.
function eventBody(ev: SiteEvent, start: Date): Record<string, any> {
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const location = ev.location || ev.zone || 'Denver';
  return {
    name: ev.title.slice(0, 100),
    description: (ev.description || '').slice(0, 1000),
    scheduled_start_time: start.toISOString(),
    scheduled_end_time: end.toISOString(),
    privacy_level: 2,        // GUILD_ONLY
    entity_type: 3,          // EXTERNAL
    entity_metadata: { location: location.slice(0, 100) },
  };
}

export async function mirrorEventCreate(
  db: D1Database,
  eventId: number,
  envBotToken: string | undefined,
): Promise<void> {
  const ev = await db.prepare("SELECT * FROM events WHERE id = ?").bind(eventId).first<SiteEvent>();
  if (!ev) return;
  // Don't mirror events that we pulled FROM Discord — would create a loop.
  if (ev.external_source === 'discord') return;
  // If we've already mirrored this event, skip (idempotent).
  if (ev.discord_mirror_event_id) return;

  const start = buildStart(ev);
  if (!start) return; // not enough date info to mirror — skip silently

  const sources = await listMirrorSources(db);
  if (sources.length === 0) return;

  for (const { config } of sources) {
    const token = resolveToken(config, envBotToken);
    if (!token) continue;

    const created = await discord<{ id: string }>(
      'POST', `/guilds/${encodeURIComponent(config.guild_id)}/scheduled-events`,
      token, eventBody(ev, start),
    );
    if (!created.ok || !created.data?.id) continue;

    let messageId: string | null = null;
    if (config.announce_channel_id) {
      const eventUrl = `${siteUrl()}/events/${ev.id}`;
      const msg = await discord<{ id: string }>(
        'POST', `/channels/${encodeURIComponent(config.announce_channel_id)}/messages`,
        token,
        { content: `📅 New event: **${ev.title}** — ${ev.event_month ?? ''} ${ev.event_day ?? ''} · ${ev.location || 'Denver'}\nRSVP: ${eventUrl}` },
      );
      if (msg.ok && msg.data?.id) messageId = msg.data.id;
    }

    await db.prepare(
      "UPDATE events SET discord_mirror_event_id = ?, discord_mirror_guild_id = ?, discord_mirror_message_id = ? WHERE id = ?"
    ).bind(created.data.id, config.guild_id, messageId, eventId).run();

    // Only mirror to the first matching guild — multi-guild mirroring would
    // need a separate join table to track an id per guild.
    return;
  }
}

export async function mirrorEventUpdate(
  db: D1Database,
  eventId: number,
  envBotToken: string | undefined,
): Promise<void> {
  const ev = await db.prepare("SELECT * FROM events WHERE id = ?").bind(eventId).first<SiteEvent>();
  if (!ev || !ev.discord_mirror_event_id || !ev.discord_mirror_guild_id) return;

  const start = buildStart(ev);
  if (!start) return;

  const sources = await listMirrorSources(db);
  const match = sources.find((s) => s.config.guild_id === ev.discord_mirror_guild_id);
  if (!match) return;

  const token = resolveToken(match.config, envBotToken);
  if (!token) return;

  await discord(
    'PATCH',
    `/guilds/${encodeURIComponent(ev.discord_mirror_guild_id)}/scheduled-events/${encodeURIComponent(ev.discord_mirror_event_id)}`,
    token, eventBody(ev, start),
  );
}

export async function mirrorEventDelete(
  db: D1Database,
  eventId: number,
  envBotToken: string | undefined,
): Promise<void> {
  const ev = await db.prepare(
    "SELECT id, discord_mirror_event_id, discord_mirror_guild_id FROM events WHERE id = ?"
  ).bind(eventId).first<SiteEvent>();
  if (!ev || !ev.discord_mirror_event_id || !ev.discord_mirror_guild_id) return;

  const sources = await listMirrorSources(db);
  const match = sources.find((s) => s.config.guild_id === ev.discord_mirror_guild_id);
  const token = match ? resolveToken(match.config, envBotToken) : null;
  if (!token) return;

  await discord(
    'DELETE',
    `/guilds/${encodeURIComponent(ev.discord_mirror_guild_id)}/scheduled-events/${encodeURIComponent(ev.discord_mirror_event_id)}`,
    token,
  );
}
