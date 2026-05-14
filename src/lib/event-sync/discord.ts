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
    return {
      source: 'discord',
      externalId: e.id,
      title: e.name || 'Discord Event',
      description: e.description || '',
      startsAt: start,
      location: e.entity_metadata?.location || '',
      url,
      eventType: 'social',
      spots: null,
    } satisfies NormalizedEvent;
  });
}
