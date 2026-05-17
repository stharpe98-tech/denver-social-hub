import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../../../lib/db';
import { canEditProfile, validateSlug } from '../../../lib/profile-auth';

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function randomHex(n: number): string {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract an R2 key from a stored URL like "/api/profile/img/u/<slug>/cover-...jpg"
function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/api\/profile\/img\/(u\/[^?#]+)/);
  return m ? m[1] : null;
}

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return err(500, 'DB unavailable');
  const UPLOADS = (env as any).UPLOADS as R2Bucket | undefined;
  if (!UPLOADS) return err(500, 'Uploads not configured');

  let form: FormData;
  try { form = await request.formData(); }
  catch { return err(400, 'Invalid form data'); }

  const slugRaw = (form.get('slug') || '').toString();
  const kind = (form.get('kind') || '').toString();
  const action = (form.get('action') || '').toString();

  const v = validateSlug(slugRaw);
  if (!v.ok) return err(400, v.error);
  const slug = v.slug;

  if (!(await canEditProfile(cookies, slug))) return err(401, 'Not authorized');

  if (kind !== 'cover' && kind !== 'avatar') return err(400, 'Invalid kind');
  const column = kind === 'cover' ? 'cover_photo_url' : 'avatar_photo_url';

  // Look up existing URL (for cleanup on overwrite or delete)
  const existing: any = await db.prepare(
    `SELECT cover_photo_url, avatar_photo_url FROM profiles WHERE slug = ?`
  ).bind(slug).first();
  const oldUrl = (existing && existing[column]) || '';

  // DELETE path
  if (action === 'delete') {
    const oldKey = keyFromUrl(oldUrl);
    if (oldKey && oldKey.startsWith('u/')) {
      try { await UPLOADS.delete(oldKey); } catch {}
    }
    await db.prepare(
      `UPDATE profiles SET ${column} = '', updated_at = ? WHERE slug = ?`
    ).bind(Date.now(), slug).run();
    return new Response(JSON.stringify({ ok: true, url: '' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const file = form.get('file');
  if (!(file instanceof File)) return err(400, 'Missing file');
  if (file.size > MAX_BYTES) return err(400, 'File too large (max 5 MB)');
  const ext = ALLOWED_MIME[file.type];
  if (!ext) return err(400, 'Unsupported file type (use JPEG, PNG, WebP, or GIF)');

  const key = `u/${slug}/${kind}-${Date.now()}-${randomHex(8)}.${ext}`;
  const buf = await file.arrayBuffer();
  await UPLOADS.put(key, buf, { httpMetadata: { contentType: file.type } });

  const url = `/api/profile/img/${key}`;
  await db.prepare(
    `UPDATE profiles SET ${column} = ?, updated_at = ? WHERE slug = ?`
  ).bind(url, Date.now(), slug).run();

  // Best-effort cleanup of old object
  const oldKey = keyFromUrl(oldUrl);
  if (oldKey && oldKey !== key && oldKey.startsWith('u/')) {
    try { await UPLOADS.delete(oldKey); } catch {}
  }

  return new Response(JSON.stringify({ ok: true, url }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
