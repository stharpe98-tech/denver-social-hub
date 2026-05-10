import type { APIContext } from 'astro';
import { getDB } from '../../../lib/db';

export const prerender = false;

export async function POST({ request, cookies }: APIContext) {
  const cookie = cookies.get("dsn_user")?.value;
  let user: any = null;
  if (cookie) { try { user = JSON.parse(cookie); } catch {} }
  if (!user) return new Response(JSON.stringify({ error: 'Not logged in' }), { status: 401 });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    const { name, photo_url, bio, neighborhood, interests, instagram, linkedin } = await request.json() as any;

    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
    }

    // Build social_links JSON
    const socialLinks: Record<string, string> = {};
    if (instagram) socialLinks.instagram = instagram;
    if (linkedin) socialLinks.linkedin = linkedin;

    // Ensure columns exist (safe ALTER — ignores if already exists)
    await db.prepare("ALTER TABLE members ADD COLUMN photo_url TEXT DEFAULT ''").run().catch(() => {});
    await db.prepare("ALTER TABLE members ADD COLUMN social_links TEXT DEFAULT ''").run().catch(() => {});
    await db.prepare("ALTER TABLE members ADD COLUMN onboarding_done INTEGER DEFAULT 0").run().catch(() => {});

    await db.prepare(
      `UPDATE members SET name=?, photo_url=?, bio=?, neighborhood=?, interests=?, social_links=?, onboarding_done=1 WHERE email=?`
    ).bind(
      name.trim(),
      (photo_url || '').trim(),
      (bio || '').trim(),
      (neighborhood || '').trim(),
      (interests || '').trim(),
      JSON.stringify(socialLinks),
      user.email
    ).run();

    // Update the session cookie with new name
    const updatedCookie = encodeURIComponent(JSON.stringify({
      ...user,
      name: name.trim()
    }));
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Set-Cookie', `dsn_user=${updatedCookie}; Path=/; Max-Age=2592000; SameSite=Lax`);

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
