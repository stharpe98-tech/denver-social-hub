import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePotluckSchema } from '../../lib/potluck-schema';
import { requireApprovedOrg } from '../../lib/admin-auth';

// All slot mutations require an approved organizer. The public read path
// continues to live in /api/potluck (GET), which doesn't need auth.
export const POST: APIRoute = async (ctx) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });

  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) {
    // Convert Astro's HTML redirect into a JSON 401/403 for fetch callers.
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  await ensurePotluckSchema(db);

  try {
    const b = await ctx.request.json() as Record<string, any>;
    const action = b.action;

    if (action === 'add') {
      const potluckId = parseInt(b.potluck_id);
      if (!potluckId || !b.suggestion) {
        return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400 });
      }
      const maxOrder = await db.prepare("SELECT MAX(sort_order) as m FROM potluck_slots WHERE potluck_id = ?")
        .bind(potluckId).first() as any;
      const sortOrder = (maxOrder?.m ?? 0) + 1;
      await db.prepare(
        "INSERT INTO potluck_slots (potluck_id, category, suggestion, max_claims, sort_order, slot_time) VALUES (?,?,?,?,?,?)"
      ).bind(
        potluckId,
        b.category || 'Items',
        b.suggestion,
        parseInt(b.max_claims) || 1,
        sortOrder,
        b.slot_time || null,
      ).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'bulk_add') {
      const potluckId = parseInt(b.potluck_id);
      const lines: string[] = (b.text ?? '').split('\n').map((l: string) => l.trim()).filter(Boolean);
      if (!potluckId || lines.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400 });
      }
      const defaultCategory = b.default_category || 'Items';
      const maxOrder = await db.prepare("SELECT MAX(sort_order) as m FROM potluck_slots WHERE potluck_id = ?")
        .bind(potluckId).first() as any;
      let nextOrder = (maxOrder?.m ?? 0) + 1;
      let added = 0;
      for (const line of lines) {
        // Pipe-delimited: "Time | Item | Category | Max" — only Item is required.
        // Bare line is treated as a single item with default category.
        const parts = line.split('|').map(s => s.trim());
        const slotTime = parts.length > 1 ? (parts[0] || null) : null;
        const suggestion = parts.length > 1 ? parts[1] : parts[0];
        const category = parts[2] || defaultCategory;
        const maxClaims = parseInt(parts[3]) || 1;
        if (!suggestion) continue;
        await db.prepare(
          "INSERT INTO potluck_slots (potluck_id, category, suggestion, max_claims, sort_order, slot_time) VALUES (?,?,?,?,?,?)"
        ).bind(potluckId, category, suggestion, maxClaims, nextOrder++, slotTime).run();
        added++;
      }
      return new Response(JSON.stringify({ ok: true, added }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'update') {
      const id = parseInt(b.id);
      if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
      await db.prepare(
        "UPDATE potluck_slots SET category = ?, suggestion = ?, max_claims = ?, slot_time = ? WHERE id = ?"
      ).bind(
        b.category || 'Items',
        b.suggestion || '',
        parseInt(b.max_claims) || 1,
        b.slot_time || null,
        id,
      ).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      const id = parseInt(b.id);
      if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
      await db.prepare("DELETE FROM potluck_slots WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: false, error: 'unknown_action' }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
