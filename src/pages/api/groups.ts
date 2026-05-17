// Group writes (create/join/leave/etc.) are organizer-only and not yet
// re-enabled. Even when the back-end is wired up, regulars will never
// be able to create groups — this gate is the forward-looking hook.
import type { APIRoute } from 'astro';

export const prerender = false;

const organizersOnly = () => new Response(
  JSON.stringify({
    ok: false,
    error: 'organizers_only',
    message: 'Group creation is for organizers only.',
  }),
  { status: 403, headers: { 'Content-Type': 'application/json' } }
);

export const POST: APIRoute = async () => organizersOnly();
