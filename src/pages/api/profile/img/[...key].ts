import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const UPLOADS = (env as any).UPLOADS as R2Bucket | undefined;
  if (!UPLOADS) return new Response('Uploads not configured', { status: 500 });

  const raw = params.key;
  const key = Array.isArray(raw) ? raw.join('/') : (raw || '');
  if (!key || !key.startsWith('u/') || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const obj = await UPLOADS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(obj.size),
    },
  });
};
