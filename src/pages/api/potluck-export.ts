import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return new Response('Error', { status: 500 });
  const pid = url.searchParams.get('id') || '1';
  const { results } = await db.prepare(
    `SELECT name, email, platforms, rsvp, guest_count, dish, dish_category, dietary, utensils, early_arrive, seating, created_at
     FROM potluck_rsvp WHERE potluck_id=? ORDER BY created_at ASC`
  ).bind(pid).all();
  const rows = results ?? [];
  const headers = ['Name','Email','Where From','RSVP','Guests','Dish','Category','Dietary','Utensils','Early Arrive','Seating','Signed Up'];
  const csv = [
    headers.join(','),
    ...rows.map((r: any) => headers.map((_,i) => {
      const vals = [r.name,r.email,r.platforms,r.rsvp,r.guest_count,r.dish,r.dish_category,r.dietary,r.utensils?'Yes':'No',r.early_arrive?'Yes':'No',r.seating?'Yes':'No',r.created_at];
      const v = String(vals[i] ?? '').replace(/"/g,'""');
      return v.includes(',') || v.includes('"') ? `"${v}"` : v;
    }).join(','))
  ].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="potluck-${pid}-signups.csv"`,
    }
  });
};
