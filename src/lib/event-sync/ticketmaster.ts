// Ticketmaster Discovery API adapter — city-based event search.
// https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
import type { NormalizedEvent } from './normalize';

interface TmEvent {
  id: string;
  name?: string;
  url?: string;
  info?: string;
  dates?: { start?: { dateTime?: string; localDate?: string } };
  classifications?: Array<{ segment?: { name?: string } }>;
  _embedded?: { venues?: Array<{ name?: string; city?: { name?: string } }> };
}

export async function fetchTicketmasterEvents(config: Record<string, string>): Promise<NormalizedEvent[]> {
  const apikey = (config.apikey || '').trim();
  const city = (config.city || '').trim();
  const stateCode = (config.state_code || '').trim();
  const classification = (config.classification || '').trim();
  if (!apikey) throw new Error('ticketmaster: missing apikey');
  if (!city) throw new Error('ticketmaster: missing city');

  const params = new URLSearchParams({
    apikey,
    city,
    size: '50',
    sort: 'date,asc',
  });
  if (stateCode) params.set('stateCode', stateCode);
  if (classification) params.set('classificationName', classification);

  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ticketmaster: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { _embedded?: { events?: TmEvent[] } };
  const events = data._embedded?.events ?? [];

  return events.map((e) => {
    const start = e.dates?.start?.dateTime ? new Date(e.dates.start.dateTime)
      : e.dates?.start?.localDate ? new Date(e.dates.start.localDate) : null;
    const venue = e._embedded?.venues?.[0];
    const location = [venue?.name, venue?.city?.name].filter(Boolean).join(' · ');
    const segment = (e.classifications?.[0]?.segment?.name || '').toLowerCase();
    const eventType = mapSegment(segment);
    return {
      source: 'ticketmaster',
      externalId: e.id,
      title: e.name || 'Ticketmaster Event',
      description: e.info || '',
      startsAt: start,
      location,
      url: e.url || '',
      eventType,
      spots: null,
    } satisfies NormalizedEvent;
  });
}

function mapSegment(s: string): string {
  if (s.includes('music')) return 'music';
  if (s.includes('sport')) return 'sports_outing';
  if (s.includes('arts') || s.includes('theatre')) return 'arts';
  return 'social';
}
