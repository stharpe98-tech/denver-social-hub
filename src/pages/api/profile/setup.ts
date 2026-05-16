// Profile setup requires an account. Disabled while accounts are offline.
import type { APIContext } from 'astro';

export const prerender = false;

export async function POST(_ctx: APIContext) {
  return new Response(JSON.stringify({ ok: false, error: 'disabled' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
