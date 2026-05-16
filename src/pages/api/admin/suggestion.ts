import type { APIContext } from 'astro';
import { getDB } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin-auth';

export const prerender = false;


export async function POST({ request, cookies }: APIContext) {
  if (!(await isAdmin(cookies))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });
  try {
    const { action, id, status } = await request.json() as any;
    if (action === 'status' && id && status) {
      await db.prepare(`UPDATE suggestions SET status=? WHERE id=?`).bind(status, id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'delete' && id) {
      await db.prepare(`DELETE FROM suggestions WHERE id=?`).bind(id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
