import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({}), { status: 500 });
  const pid = url.searchParams.get('id');

  if (pid) {
    const [rsvps, dishes, sources, timeline, waitlist] = await Promise.all([
      db.prepare(`SELECT rsvp, COUNT(*) as count, SUM(guest_count) as guests FROM potluck_rsvp WHERE potluck_id=? GROUP BY rsvp`).bind(pid).all(),
      db.prepare(`SELECT dish, COUNT(*) as count FROM potluck_rsvp WHERE potluck_id=? AND rsvp='yes' AND dish!='' GROUP BY LOWER(dish) ORDER BY count DESC LIMIT 10`).bind(pid).all(),
      db.prepare(`SELECT platforms, COUNT(*) as count FROM potluck_rsvp WHERE potluck_id=? AND platforms!='' GROUP BY platforms ORDER BY count DESC`).bind(pid).all(),
      db.prepare(`SELECT DATE(created_at) as day, COUNT(*) as signups FROM potluck_rsvp WHERE potluck_id=? GROUP BY day ORDER BY day ASC`).bind(pid).all(),
      db.prepare(`SELECT COUNT(*) as count FROM potluck_waitlist WHERE potluck_id=?`).bind(pid).first(),
    ]);
    return new Response(JSON.stringify({
      rsvps: rsvps.results, dishes: dishes.results,
      sources: sources.results, timeline: timeline.results,
      waitlist: (waitlist as any)?.count ?? 0,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Global analytics
  const [total_events, total_signups, total_guests] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as count FROM potlucks`).first(),
    db.prepare(`SELECT COUNT(*) as count FROM potluck_rsvp WHERE rsvp='yes'`).first(),
    db.prepare(`SELECT SUM(guest_count) as total FROM potluck_rsvp WHERE rsvp='yes'`).first(),
  ]);
  return new Response(JSON.stringify({
    total_events: (total_events as any)?.count ?? 0,
    total_signups: (total_signups as any)?.count ?? 0,
    total_guests: (total_guests as any)?.total ?? 0,
  }), { headers: { 'Content-Type': 'application/json' } });
};
