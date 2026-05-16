import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { getAllowedAdminEmails } from '../../../lib/admin-auth';

function gen6(): string {
  // Use crypto.getRandomValues so the code isn't predictable.
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1_000_000).toString().padStart(6, '0');
}

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }
  const email = (body?.email || '').toString().trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }), { status: 400 });
  }

  const allowed = await getAllowedAdminEmails(db);
  const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });

  // Always respond ok=true to prevent allowlist enumeration. Only send
  // and insert a code when the address is actually allowed.
  if (allowed.includes(email)) {
    const code = gen6();
    const now = Date.now();
    const expires = now + 10 * 60 * 1000; // 10 minutes
    try {
      await db.prepare(
        `INSERT INTO admin_codes (email, code, expires_at, used, created_at) VALUES (?,?,?,0,?)`
      ).bind(email, code, expires, now).run();
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'DB insert failed' }), { status: 500 });
    }

    if (cfg.resend_api_key) {
      const subject = `Denver Social admin code: ${code}`;
      const text = `Your 6-digit admin sign-in code is:\n\n${code}\n\nIt expires in 10 minutes. If you didn't request this, ignore this email.`;
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 12px">Denver Social admin</h2>
          <p style="color:#555;margin:0 0 16px">Your one-time sign-in code:</p>
          <div style="font-size:32px;letter-spacing:8px;font-weight:700;padding:16px 24px;background:#F5EFE3;border:1px solid #DDD2BB;border-radius:12px;text-align:center;color:#2A2730">${code}</div>
          <p style="color:#888;font-size:13px;margin:16px 0 0">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
        </div>`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.resend_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
            to: email,
            subject,
            text,
            html,
          }),
        });
      } catch {
        // Swallow — we still return ok to the client. The code is in the
        // DB; resending will succeed once Resend is reachable again.
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
