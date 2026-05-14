// Facebook Page events adapter — Graph API.
// Heads up: only works for Pages where the user has admin access and has
// generated a Page Access Token with pages_read_engagement. The pre-2018
// public events API is permanently gone.
import type { NormalizedEvent } from './normalize';

interface FbEvent {
  id: string;
  name?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  place?: { name?: string; location?: { city?: string; state?: string } };
}

export async function fetchFacebookEvents(config: Record<string, string>): Promise<NormalizedEvent[]> {
  const pageId = (config.page_id || '').trim();
  const token = (config.access_token || '').trim();
  if (!pageId) throw new Error('facebook: missing page_id');
  if (!token) throw new Error('facebook: missing access_token');

  const fields = 'id,name,description,start_time,end_time,place';
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(pageId)}/events?time_filter=upcoming&fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`facebook: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: FbEvent[]; error?: { message?: string } };
  if (data.error) throw new Error(`facebook: ${data.error.message || 'graph error'}`);
  const events = data.data ?? [];

  return events.map((e) => {
    const start = e.start_time ? new Date(e.start_time) : null;
    const place = e.place;
    const location = place?.name || [place?.location?.city, place?.location?.state].filter(Boolean).join(', ');
    return {
      source: 'facebook',
      externalId: e.id,
      title: e.name || 'Facebook Event',
      description: e.description || '',
      startsAt: start,
      location: location || '',
      url: `https://facebook.com/events/${e.id}`,
      eventType: 'social',
      spots: null,
    } satisfies NormalizedEvent;
  });
}
