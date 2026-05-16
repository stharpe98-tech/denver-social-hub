// Member card modal requires identity to compute viewer-relative state
// (mutual groups, phone-request status). Disabled while accounts are
// offline.
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => new Response(
  JSON.stringify({ ok: false, error: 'disabled' }),
  { status: 200, headers: { 'Content-Type': 'application/json' } }
);
