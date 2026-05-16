import type { APIRoute } from 'astro';
import { clearAdminCookie } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  clearAdminCookie({ cookies } as any);
  return redirect('/');
};

export const POST: APIRoute = async ({ cookies }) => {
  clearAdminCookie({ cookies } as any);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
