// Luma (lu.ma) adapter — pulls events from a calendar.
// API: GET https://api.lu.ma/public/v1/calendar/list-events?calendar_api_id=...
// Auth header: x-luma-api-key
import type { NormalizedEvent } from './normalize';

interface LumaEntry {
  api_id?: string;
  event?: {
    api_id?: string;
    name?: string;
    description?: string;
    start_at?: string;
    url?: string;
    geo_address_json?: { address?: string; city?: string } | null;
  };
}

export async function fetchLumaEvents(config: Record<string, string>): Promise<NormalizedEvent[]> {
  const apiKey = (config.api_key || '').trim();
  const calendarId = (config.calendar_api_id || '').trim();
  if (!apiKey) throw new Error('luma: missing api_key');
  if (!calendarId) throw new Error('luma: missing calendar_api_id');

  const url = `https://api.lu.ma/public/v1/calendar/list-events?calendar_api_id=${encodeURIComponent(calendarId)}`;
  const res = await fetch(url, { headers: { 'x-luma-api-key': apiKey, Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`luma: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { entries?: LumaEntry[] };
  const entries = data.entries ?? [];

  return entries.map((entry) => {
    const e = entry.event ?? {};
    const id = e.api_id || entry.api_id || '';
    const start = e.start_at ? new Date(e.start_at) : null;
    const geo = e.geo_address_json || null;
    const location = geo?.address || geo?.city || '';
    return {
      source: 'luma',
      externalId: id,
      title: e.name || 'Luma Event',
      description: e.description || '',
      startsAt: start,
      location,
      url: e.url || '',
      eventType: 'social',
      spots: null,
    } satisfies NormalizedEvent;
  }).filter((e) => e.externalId);
}
