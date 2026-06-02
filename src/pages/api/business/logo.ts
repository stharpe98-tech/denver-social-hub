import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

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
function err(status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

// Business-logo upload. Stored under the "u/biz/" prefix so the existing
// /api/profile/img/[...key] route (which only serves keys starting with "u/")
// can serve it without modification.
export const POST: APIRoute = async ({ request }) => {
  const UPLOADS = (env as any).UPLOADS as R2Bucket | undefined;
  if (!UPLOADS) return err(500, 'Uploads not configured');

  let form: FormData;
  try { form = await request.formData(); }
  catch { return err(400, 'Invalid form data'); }

  const file = form.get('file');
  if (!(file instanceof File)) return err(400, 'Missing file');
  if (file.size > MAX_BYTES) return err(400, 'File too large (max 5 MB)');
  const ext = ALLOWED_MIME[file.type];
  if (!ext) return err(400, 'Unsupported file type (use JPEG, PNG, WebP, or GIF)');

  const key = `u/biz/${randomHex(12)}.${ext}`;
  const buf = await file.arrayBuffer();
  await UPLOADS.put(key, buf, { httpMetadata: { contentType: file.type } });

  return new Response(JSON.stringify({ ok: true, url: `/api/profile/img/${key}` }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
