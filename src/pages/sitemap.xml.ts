import type { APIRoute } from 'astro';
import { getDB } from '../lib/db';

const BASE = 'https://denversocialhub.com';

const STATIC_PATHS = [
  '/',
  '/events',
  '/community',
  '/about',
  '/help',
  '/privacy',
  '/terms',
  '/profile/new',
];

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!)
  );
}

export const GET: APIRoute = async () => {
  const db = getDB();
  const urls: string[] = STATIC_PATHS.map((p) => `${BASE}${p}`);

  if (db) {
    try {
      const r = await db.prepare("SELECT id FROM events").all();
      for (const row of (r.results ?? []) as any[]) {
        if (row.id != null) urls.push(`${BASE}/events/${row.id}`);
      }
    } catch {}
    try {
      const r = await db.prepare("SELECT slug FROM profiles WHERE status='live' AND tier='organizer'").all();
      for (const row of (r.results ?? []) as any[]) {
        if (row.slug) urls.push(`${BASE}/u/${row.slug}`);
      }
    } catch {}
    try {
      const r = await db.prepare("SELECT id FROM potlucks").all();
      for (const row of (r.results ?? []) as any[]) {
        if (row.id != null) urls.push(`${BASE}/potlucks/${row.id}`);
      }
    } catch {}
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
