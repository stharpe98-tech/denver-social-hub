// Minimal ICS (iCalendar RFC 5545) parser — only the fields we need for
// /events display. Handles VEVENT blocks, line unfolding, escape sequences,
// and the common DTSTART formats: YYYYMMDD, YYYYMMDDTHHMMSSZ, and
// DTSTART;TZID=...:YYYYMMDDTHHMMSS (treated as floating UTC — good enough
// for date/day display).
//
// Works for Meetup group iCal exports, Google Calendar "secret address",
// Apple Calendar publish URLs, Eventbrite organizer iCal — any ICS feed.
import type { NormalizedEvent } from './normalize';

export async function fetchIcsEvents(config: Record<string, string>): Promise<NormalizedEvent[]> {
  const url = (config.url || '').trim();
  if (!url) throw new Error('ics: missing url in config');
  if (!/^https?:\/\//i.test(url)) throw new Error('ics: url must be http(s)');

  const res = await fetch(url, { headers: { 'User-Agent': 'DenverSocialHub-Sync/1.0' } });
  if (!res.ok) throw new Error(`ics: ${res.status}`);
  const text = await res.text();

  const events = parseIcs(text);
  return events.map((e) => ({
    source: 'ics',
    externalId: e.uid || `${url}#${e.summary}-${e.dtstart || ''}`,
    title: e.summary || 'Calendar Event',
    description: e.description || '',
    startsAt: e.start,
    location: e.location || '',
    url: e.urlField || url,
    eventType: 'social',
    spots: null,
  } satisfies NormalizedEvent));
}

interface ParsedVEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  urlField?: string;
  dtstart?: string;
  start: Date | null;
}

function parseIcs(text: string): ParsedVEvent[] {
  // RFC 5545 line unfolding: CRLF + (space | tab) continues the previous line.
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const out: ParsedVEvent[] = [];
  let current: ParsedVEvent | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') { current = { start: null }; continue; }
    if (line === 'END:VEVENT') {
      if (current) {
        current.start = current.dtstart ? parseIcsDate(current.dtstart) : null;
        out.push(current);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    // Split "NAME[;params]:value" — the first ':' that isn't inside params.
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = unescapeIcs(line.slice(colon + 1));
    const name = head.split(';')[0].toUpperCase();

    switch (name) {
      case 'UID': current.uid = value; break;
      case 'SUMMARY': current.summary = value; break;
      case 'DESCRIPTION': current.description = value; break;
      case 'LOCATION': current.location = value; break;
      case 'URL': current.urlField = value; break;
      case 'DTSTART': current.dtstart = value; break;
    }
  }
  return out;
}

function unescapeIcs(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseIcsDate(s: string): Date | null {
  // Date-only: YYYYMMDD
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // Date-time UTC: YYYYMMDDTHHMMSSZ — or floating local (no Z), we treat as UTC
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return null;
}

