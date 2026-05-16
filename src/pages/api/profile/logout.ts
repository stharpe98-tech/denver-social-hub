import type { APIRoute } from 'astro';
import { clearProfileCookie, validateSlug } from '../../../lib/profile-auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  let slug = '';
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { const b = await request.json(); slug = (b?.slug || '').toString(); } catch {}
  } else {
    const url = new URL(request.url);
    slug = url.searchParams.get('slug') || '';
  }
  const v = validateSlug(slug);
  if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });
  clearProfileCookie({ cookies } as any, v.slug);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const slug = new URL(url).searchParams.get('slug') || '';
  const v = validateSlug(slug);
  if (v.ok) clearProfileCookie({ cookies } as any, v.slug);
  return redirect(v.ok ? `/u/${v.slug}` : '/');
};
