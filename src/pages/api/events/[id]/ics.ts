// Generates an iCalendar (.ics) file for an event so visitors can add it
// to Apple/Outlook/any standards-compliant calendar app. Google has its
// own URL-based "add" flow; this is for everyone else.
import type { APIRoute } from 'astro';
import { getDB } from '../../../../lib/db';

export const prerender = false;

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function pad(n: number | string, w = 2) {
  return String(n).padStart(w, '0');
}

function escapeICS(s: string): string {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export const GET: APIRoute = async ({ params }) => {
  const db = getDB();
  if (!db) return new Response('DB unavailable', { status: 500 });
  const id = params.id;
  const ev: any = await db.prepare('SELECT * FROM events WHERE id=?').bind(id).first();
  if (!ev) return new Response('Not found', { status: 404 });

  const mo = MONTHS[(ev.event_month || '').toUpperCase()];
  const day = pad(ev.event_day || '01');
  const yr = new Date().getFullYear();
  if (!mo) return new Response('Event has no date', { status: 400 });

  // Default to 6pm–9pm Denver time when we don't have an explicit time.
  // Denver is UTC-7 (MDT) most of the year; UTC-6 (MST) Nov–Mar. Simplified
  // to MDT here — calendar apps will display the local equivalent.
  const dateStart = `${yr}${mo}${day}T180000`;
  const dateEnd   = `${yr}${mo}${day}T210000`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `event-${ev.id}@denversocialhub.com`;
  const summary = escapeICS(ev.title || 'Denver Social event');
  const description = escapeICS((ev.description || '') + '\n\nhttps://denversocialhub.com/events/' + ev.id);
  const location = escapeICS(ev.location || ev.zone || 'Denver');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Denver Social//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=America/Denver:${dateStart}`,
    `DTEND;TZID=America/Denver:${dateEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `URL:https://denversocialhub.com/events/${ev.id}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="denver-social-event-${ev.id}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
};
