// Bulk delete /u/[slug] profiles. Admin-only.
// Body: { slugs: string[], confirm: 'DELETE' }
// Loops over slugs and applies cascadeDeleteProfile to each.
// Returns { ok, deleted: [...], errors: [{ slug, error }, ...] }.

import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { env } from 'cloudflare:workers';
import { isAdmin as isAdminCookie } from '../../../lib/admin-auth';
import { cascadeDeleteProfile } from '../../../lib/profile-cleanup';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAdminCookie(cookies))) {
    return new Response(JSON.stringify({ ok: false, error: 'not_authorized' }), { status: 403 });
  }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'db_unavailable' }), { status: 500 });

  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'invalid_body' }), { status: 400 }); }

  const confirm = (body?.confirm || '').toString();
  if (confirm !== 'DELETE') {
    return new Response(JSON.stringify({ ok: false, error: 'confirm_mismatch', hint: 'confirm must equal "DELETE"' }), { status: 400 });
  }

  const rawSlugs = Array.isArray(body?.slugs) ? body.slugs : [];
  const slugs = Array.from(new Set(
    rawSlugs
      .map((s: any) => (s || '').toString().trim().toLowerCase())
      .filter((s: string) => !!s)
  )) as string[];

  if (slugs.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'no_slugs' }), { status: 400 });
  }
  if (slugs.length > 200) {
    return new Response(JSON.stringify({ ok: false, error: 'too_many', hint: 'max 200 per request' }), { status: 400 });
  }

  const deleted: string[] = [];
  const errors: Array<{ slug: string; error: string }> = [];

  for (const slug of slugs) {
    try {
      const result = await cascadeDeleteProfile(db, env, slug);
      if (result.notFound) {
        errors.push({ slug, error: 'not_found' });
        continue;
      }
      deleted.push(slug);
      for (const e of result.errors) errors.push({ slug, error: e });
    } catch (e: any) {
      errors.push({ slug, error: e?.message || 'unknown' });
    }
  }

  return new Response(JSON.stringify({ ok: true, deleted, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
