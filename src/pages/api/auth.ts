import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'dsn-salt-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;

    if (b.action === 'register') {
      const { name, email, password } = b;
      if (!name || !email || !password) return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), { status: 400 });
      const hash = await hashPassword(password);
      await db.prepare(`INSERT INTO organizers (name, email, password_hash, white_label_name) VALUES (?,?,?,?)`)
        .bind(name, email, hash, name).run();
      const org = await db.prepare(`SELECT id, name, email, plan, white_label_name FROM organizers WHERE email=?`).bind(email).first() as any;
      cookies.set('dsn_org', JSON.stringify({ id: org.id, name: org.name, email: org.email, plan: org.plan }), { path: '/', maxAge: 60*60*24*30, httpOnly: true });
      return new Response(JSON.stringify({ ok: true, org }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (b.action === 'login') {
      const { email, password } = b;
      const hash = await hashPassword(password);
      const org = await db.prepare(`SELECT id, name, email, plan, white_label_name FROM organizers WHERE email=? AND password_hash=?`).bind(email, hash).first() as any;
      if (!org) return new Response(JSON.stringify({ ok: false, error: 'Invalid email or password' }), { status: 401 });
      cookies.set('dsn_org', JSON.stringify({ id: org.id, name: org.name, email: org.email, plan: org.plan }), { path: '/', maxAge: 60*60*24*30, httpOnly: true });
      return new Response(JSON.stringify({ ok: true, org }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (b.action === 'logout') {
      cookies.delete('dsn_org', { path: '/' });
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (b.action === 'update_profile') {
      const cookie = request.headers.get('cookie') ?? '';
      const match = cookie.match(/dsn_org=([^;]+)/);
      if (!match) return new Response(JSON.stringify({ ok: false }), { status: 401 });
      const org = JSON.parse(decodeURIComponent(match[1]));
      await db.prepare(`UPDATE organizers SET white_label_name=?, white_label_logo=?, stripe_link=? WHERE id=?`)
        .bind(b.white_label_name??'', b.white_label_logo??'', b.stripe_link??'', org.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
