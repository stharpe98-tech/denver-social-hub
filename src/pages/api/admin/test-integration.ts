// Test each integration's credentials and report back whether they
// actually work. Admin-gated. No side effects (no real emails or SMS
// get sent — we just hit lightweight info/verify endpoints).
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin-auth';

export const prerender = false;

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

async function readCfg(db: D1Database, key: string): Promise<string> {
  try {
    const row: any = await db.prepare('SELECT value FROM config WHERE key=?').bind(key).first();
    return row?.value || '';
  } catch { return ''; }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAdmin(cookies))) return bad('not_authorized', 403);

  const db = getDB();
  if (!db) return bad('db', 500);

  const body = await request.json().catch(() => ({})) as any;
  const kind = body?.kind as string;

  // ── Resend ──
  if (kind === 'resend') {
    const apiKey = await readCfg(db, 'resend_api_key');
    if (!apiKey) return bad('Save a Resend API key first.');
    try {
      const r = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (r.status === 401) return bad('Resend rejected the key. Double-check the value — it should start with re_.');
      if (!r.ok) return bad(`Resend returned ${r.status}. Try regenerating the key.`);
      const data: any = await r.json();
      const count = Array.isArray(data?.data) ? data.data.length : 0;
      return ok({ message: `Key works ✓ ${count} domain${count === 1 ? '' : 's'} verified.` });
    } catch (e: any) { return bad(`Network error: ${e?.message || 'unknown'}`); }
  }

  // ── Discord OAuth ──
  if (kind === 'discord') {
    const clientId = await readCfg(db, 'discord_client_id');
    if (!clientId) return bad('Save a Client ID first.');
    if (!/^\d{17,20}$/.test(clientId.trim())) {
      return bad(`Client ID looks wrong (must be a 17–20 digit number — yours is "${clientId}").`);
    }
    try {
      const r = await fetch(`https://discord.com/api/v10/applications/${encodeURIComponent(clientId.trim())}/rpc`, {
        headers: { 'User-Agent': 'DenverSocialHub-Test/1.0' },
      });
      if (r.status === 404) return bad('Discord doesn\'t recognize that Client ID. Check Developer Portal → your app → General Information → APPLICATION ID.');
      if (!r.ok) return bad(`Discord returned ${r.status} when looking up that app.`);
      const data: any = await r.json();
      const secret = await readCfg(db, 'discord_client_secret');
      const secretNote = secret ? '' : ' But you haven\'t saved a Client Secret yet — login will still fail until you do.';
      return ok({ message: `Client ID matches "${data?.name || 'unknown'}" ✓${secretNote}` });
    } catch (e: any) { return bad(`Network error: ${e?.message || 'unknown'}`); }
  }

  // ── Twilio ──
  if (kind === 'twilio') {
    const sid = await readCfg(db, 'twilio_account_sid');
    const token = await readCfg(db, 'twilio_auth_token');
    if (!sid || !token) return bad('Save Account SID + Auth Token first.');
    try {
      const auth = btoa(`${sid}:${token}`);
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (r.status === 401) return bad('Twilio rejected the credentials. Check the Account SID + Auth Token.');
      if (!r.ok) return bad(`Twilio returned ${r.status}.`);
      const data: any = await r.json();
      return ok({ message: `Twilio account "${data?.friendly_name || sid.slice(0,10)}…" connected ✓ Status: ${data?.status || 'active'}.` });
    } catch (e: any) { return bad(`Network error: ${e?.message || 'unknown'}`); }
  }

  // ── Cloudflare Turnstile ──
  if (kind === 'turnstile') {
    const secret = await readCfg(db, 'turnstile_secret_key');
    if (!secret) return bad('Save a Turnstile secret key first.');
    try {
      const form = new URLSearchParams();
      form.set('secret', secret);
      form.set('response', 'XXXX.DUMMY.TOKEN.XXXX'); // intentionally bad token
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const data: any = await r.json();
      const errors: string[] = data?.['error-codes'] || [];
      // We expect failure (dummy token), but the secret itself should be accepted
      if (errors.includes('invalid-input-secret')) {
        return bad('Cloudflare rejected the secret key. Double-check it.');
      }
      return ok({ message: 'Secret key is valid ✓ Turnstile will accept it.' });
    } catch (e: any) { return bad(`Network error: ${e?.message || 'unknown'}`); }
  }

  // ── Webhook ──
  if (kind === 'webhook') {
    const url = await readCfg(db, 'webhook_url');
    if (!url) return bad('Save a webhook URL first.');
    if (!url.startsWith('http')) return bad('Webhook URL must start with https://');
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, source: 'denver-social-hub', timestamp: new Date().toISOString() }),
      });
      if (!r.ok && r.status !== 200) return bad(`Webhook returned ${r.status} — check the URL.`);
      return ok({ message: `Webhook accepted the test payload ✓ (${r.status})` });
    } catch (e: any) { return bad(`Couldn't reach the webhook: ${e?.message || 'unknown'}`); }
  }

  return bad('Unknown integration.');
};
