// Group post writes require identity. Disabled while accounts are
// offline; schema is preserved.
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async () => new Response(
  JSON.stringify({ ok: false, error: 'disabled' }),
  { status: 200, headers: { 'Content-Type': 'application/json' } }
);
