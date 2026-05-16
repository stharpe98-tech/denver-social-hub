// Group writes (create/join/leave/etc.) require identity. While
// accounts are offline, this endpoint returns { error: 'disabled' }.
// Browsing groups remains public via the page routes which query
// the schema directly.
import type { APIRoute } from 'astro';

export const prerender = false;

const disabled = () => new Response(
  JSON.stringify({ ok: false, error: 'disabled' }),
  { status: 200, headers: { 'Content-Type': 'application/json' } }
);

export const POST: APIRoute = async () => disabled();
