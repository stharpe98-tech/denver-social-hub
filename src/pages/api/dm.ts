// Messaging is offline while accounts are reworked. The schema is
// preserved; this endpoint short-circuits all reads and writes.
import type { APIRoute } from 'astro';

const disabled = () => new Response(
  JSON.stringify({ ok: false, error: 'disabled', threads: [], messages: [] }),
  { status: 200, headers: { 'Content-Type': 'application/json' } }
);

export const GET: APIRoute = async () => disabled();
export const POST: APIRoute = async () => disabled();
