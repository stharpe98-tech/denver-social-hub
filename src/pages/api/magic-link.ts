// Legacy organizer magic-link endpoint. Superseded by
// /api/admin/code-send + /api/admin/code-verify. Kept as a no-op so
// older bookmarks don't 404.
import type { APIContext } from 'astro';

export const prerender = false;

export async function POST(_ctx: APIContext) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
