// Eventbrite adapter — pulls live events for an organization.
// API: GET /v3/organizations/{org_id}/events/?status=live (Bearer token).
// https://www.eventbrite.com/platform/api
import type { NormalizedEvent } from './normalize';

interface EventbriteEvent {
  id: string;
  name?: { text?: string };
  description?: { text?: string };
  start?: { utc?: string; local?: string };
  url?: string;
  online_event?: boolean;
  venue_id?: string | null;
}

export async function fetchEventbriteEvents(
  config: Record<string, string>,
): Promise<NormalizedEvent[]> {
  const token = (config.token || '').trim();
  const orgId = (config.organization_id || '').trim();
  if (!token) throw new Error('eventbrite: missing token');
  if (!orgId) throw new Error('eventbrite: missing organization_id');

  const url = `https://www.eventbriteapi.com/v3/organizations/${encodeURIComponent(orgId)}/events/?status=live&order_by=start_asc&expand=venue`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`eventbrite: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { events?: Array<EventbriteEvent & { venue?: any }> };
  const events = data.events ?? [];

  return events.map((e) => {
    const start = e.start?.utc ? new Date(e.start.utc) : null;
    const v = (e as any).venue;
    const location = v?.address?.localized_address_display || v?.name || (e.online_event ? 'Online' : '');
    return {
      source: 'eventbrite',
      externalId: e.id,
      title: e.name?.text || 'Eventbrite Event',
      description: e.description?.text || '',
      startsAt: start,
      location,
      url: e.url || '',
      eventType: 'social',
      spots: null,
    } satisfies NormalizedEvent;
  });
}
