import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { getAllowedAdminEmails, setAdminCookie } from '../../../lib/admin-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }
  const email = (body?.email || '').toString().trim().toLowerCase();
  const code = (body?.code || '').toString().trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email or code' }), { status: 400 });
  }

  const allowed = await getAllowedAdminEmails(db);
  if (!allowed.includes(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code' }), { status: 401 });
  }

  const now = Date.now();
  const row = await db.prepare(
    `SELECT rowid AS id, expires_at, used FROM admin_codes
     WHERE email = ? AND code = ? AND used = 0 AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`
  ).bind(email, code, now).first() as any;

  if (!row) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code' }), { status: 401 });
  }

  await db.prepare(`UPDATE admin_codes SET used = 1 WHERE rowid = ?`).bind(row.id).run();
  await setAdminCookie({ cookies } as any, email);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
