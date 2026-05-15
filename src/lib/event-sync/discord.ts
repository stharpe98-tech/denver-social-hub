// Discord scheduled-events adapter.
// Config: { guild_id, token? }. Falls back to env DISCORD_BOT_TOKEN if no token.
// Uses guild.scheduled_events list — requires the bot to be in the guild.
import type { NormalizedEvent } from './normalize';

interface DiscordScheduledEvent {
  id: string;
  guild_id: string;
  name: string;
  description?: string | null;
  scheduled_start_time?: string;
  scheduled_end_time?: string | null;
  entity_metadata?: { location?: string } | null;
  channel_id?: string | null;
}

// Discord hosts often bake the venue into the event name
// ("Sunset hike at Mount Falcon"). When Discord doesn't set its own
// location field, split the title on " at " / " @ " / " - " and pull
// the trailing chunk into location. The split is conservative — we only
// trigger when the prefix is meaningfully long, so we don't mangle
// "Dinner at 7" style titles.
const SPLIT_PATTERNS = [' at ', ' @ ', ' - ', ' — ', ' – '];

// Words that stay lowercase in title-case unless they start the string
const KEEP_LOWER = new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','vs','with']);

function titleCase(s: string): string {
  return (s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && KEEP_LOWER.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function sentenceCase(s: string): string {
  const t = (s || '').trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function splitTitleAndLocation(title: string): { title: string; location: string } {
  const t = (title || '').trim();
  if (!t) return { title: t, location: '' };
  for (const sep of SPLIT_PATTERNS) {
    const idx = t.toLowerCase().lastIndexOf(sep);
    if (idx <= 0) continue;
    const left = t.slice(0, idx).trim();
    const right = t.slice(idx + sep.length).trim();
    // Both halves must be substantive to be worth splitting
    if (left.length >= 3 && right.length >= 3 && /[A-Za-z]/.test(right)) {
      return {
        title: sentenceCase(left),
        location: titleCase(right),
      };
    }
  }
  return { title: t, location: '' };
}

export async function fetchDiscordEvents(
  config: Record<string, string>,
  envToken: string | undefined,
): Promise<NormalizedEvent[]> {
  const guildId = (config.guild_id || '').trim();
  if (!guildId) throw new Error('discord: missing guild_id in config');
  const token = (config.token || envToken || '').trim();
  if (!token) throw new Error('discord: missing bot token (set DISCORD_BOT_TOKEN or config.token)');
  const authHeader = token.toLowerCase().startsWith('bot ') ? token : `Bot ${token}`;

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/scheduled-events?with_user_count=false`,
    { headers: { Authorization: authHeader, 'User-Agent': 'DenverSocialHub-Sync/1.0' } },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`discord: ${res.status} ${body.slice(0, 200)}`);
  }
  const list = (await res.json()) as DiscordScheduledEvent[];
  if (!Array.isArray(list)) throw new Error('discord: unexpected response shape');

  return list.map((e) => {
    const start = e.scheduled_start_time ? new Date(e.scheduled_start_time) : null;
    const url = `https://discord.com/events/${e.guild_id}/${e.id}`;

    // Discord's explicit location wins. If empty, try to extract it from
    // the title (host habit: "Sunset hike at Mount Falcon").
    const discordLocation = e.entity_metadata?.location || '';
    let title = e.name || 'Discord Event';
    let location = discordLocation;
    if (!location) {
      const split = splitTitleAndLocation(title);
      if (split.location) {
        title = split.title;
        location = split.location;
      }
    }

    return {
      source: 'discord',
      externalId: e.id,
      title,
      description: e.description || '',
      startsAt: start,
      location,
      url,
      eventType: 'social',
      spots: null,
    } satisfies NormalizedEvent;
  });
}
