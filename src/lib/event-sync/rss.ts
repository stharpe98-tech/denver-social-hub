// RSS / Atom feed adapter. Minimal XML parser — we only need title, link,
// description, and pubDate per item. Works for both <rss><channel><item>…
// and <feed><entry>… (Atom) shapes.
import type { NormalizedEvent } from './normalize';

export async function fetchRssEvents(config: Record<string, string>): Promise<NormalizedEvent[]> {
  const url = (config.url || '').trim();
  if (!url) throw new Error('rss: missing url');
  if (!/^https?:\/\//i.test(url)) throw new Error('rss: url must be http(s)');

  const res = await fetch(url, { headers: { 'User-Agent': 'DenverSocialHub-Sync/1.0', Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*' } });
  if (!res.ok) throw new Error(`rss: ${res.status}`);
  const text = await res.text();

  // RSS items
  const rssItems = [...text.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => parseRssItem(m[1], url));
  if (rssItems.length) return rssItems;

  // Atom entries
  const atomItems = [...text.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => parseAtomEntry(m[1], url));
  return atomItems;
}

function parseRssItem(body: string, feedUrl: string): NormalizedEvent {
  const title = tag(body, 'title') || 'RSS Item';
  const link = tag(body, 'link');
  const description = tag(body, 'description');
  const pubDate = tag(body, 'pubDate') || tag(body, 'dc:date');
  const guid = tag(body, 'guid') || link || `${feedUrl}#${title}`;
  const start = pubDate ? new Date(pubDate) : null;
  return {
    source: 'rss',
    externalId: guid,
    title: stripTags(title).slice(0, 200),
    description: stripTags(description).slice(0, 1000),
    startsAt: isValidDate(start) ? start : null,
    location: '',
    url: link,
    eventType: 'social',
    spots: null,
  };
}

function parseAtomEntry(body: string, feedUrl: string): NormalizedEvent {
  const title = tag(body, 'title') || 'Atom Entry';
  // <link href="..."/> form
  const linkMatch = body.match(/<link\b[^>]*href=["']([^"']+)["']/i);
  const link = linkMatch?.[1] || '';
  const summary = tag(body, 'summary') || tag(body, 'content');
  const published = tag(body, 'published') || tag(body, 'updated');
  const id = tag(body, 'id') || link || `${feedUrl}#${title}`;
  const start = published ? new Date(published) : null;
  return {
    source: 'rss',
    externalId: id,
    title: stripTags(title).slice(0, 200),
    description: stripTags(summary).slice(0, 1000),
    startsAt: isValidDate(start) ? start : null,
    location: '',
    url: link,
    eventType: 'social',
    spots: null,
  };
}

function tag(body: string, name: string): string {
  // Handles CDATA and plain text. Matches the first occurrence.
  const re = new RegExp(`<${escape(name)}\\b[^>]*>([\\s\\S]*?)</${escape(name)}>`, 'i');
  const m = body.match(re);
  if (!m) return '';
  const inner = m[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1] : inner;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function isValidDate(d: Date | null): d is Date { return !!d && !isNaN(d.getTime()); }
