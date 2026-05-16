import { env } from "cloudflare:workers";
import { getDB } from "../../../lib/db";
import {
  InteractionType,
  InteractionResponseType,
  verifyDiscordSignature,
  reply,
  json,
  siteUrlFrom,
} from "../../../lib/discord";

const ACCENT = 0x7c3aed; // matches site --accent

type CmdOption = { name: string; value: any };

function optMap(options: CmdOption[] | undefined): Record<string, any> {
  const m: Record<string, any> = {};
  (options || []).forEach((o) => { m[o.name] = o.value; });
  return m;
}

async function listEvents(db: D1Database, siteUrl: string) {
  const rows: any[] = ((await db
    .prepare("SELECT id, title, event_type, event_month, event_day, zone, location, spots FROM events WHERE is_past IS NULL OR is_past=0 ORDER BY id DESC")
    .all())?.results) || [];

  // Filter to future-ish entries the same way the site does — but here we keep
  // it simple: any non-past row, capped at 5, ordered by month/day.
  const monthOrder: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  rows.sort((a, b) => {
    const am = monthOrder[(a.event_month || "").toUpperCase()] ?? 99;
    const bm = monthOrder[(b.event_month || "").toUpperCase()] ?? 99;
    if (am !== bm) return am - bm;
    return (parseInt(a.event_day) || 99) - (parseInt(b.event_day) || 99);
  });
  const top = rows.slice(0, 5);

  if (top.length === 0) {
    return reply(`No upcoming events yet. ${siteUrl}/events`);
  }

  const fields = top.map((e) => ({
    name: `${e.event_month || "TBD"} ${e.event_day || ""} — ${e.title}`.trim(),
    value: `${e.event_type || "event"} · ${e.zone || e.location || "Denver"}\n${siteUrl}/events/${e.id}`,
  }));

  return reply("", {
    embeds: [{
      title: "Upcoming Denver Social Nights",
      url: `${siteUrl}/events`,
      color: ACCENT,
      fields,
      footer: { text: "denversocial · /event <id> for details" },
    }],
  });
}

async function eventDetail(db: D1Database, siteUrl: string, id: number) {
  const ev: any = await db
    .prepare("SELECT * FROM events WHERE id=?")
    .bind(id)
    .first();
  if (!ev) return reply(`No event with id ${id}. Try \`/events\`.`, { ephemeral: true });

  const url = `${siteUrl}/events/${ev.id}`;
  const desc = (ev.description || "").toString();
  return reply("", {
    embeds: [{
      title: ev.title,
      url,
      description: desc.length > 400 ? desc.slice(0, 400) + "…" : desc,
      color: ACCENT,
      fields: [
        { name: "When", value: `${ev.event_month || "TBD"} ${ev.event_day || ""}`.trim(), inline: true },
        { name: "Where", value: ev.zone || ev.location || "Denver", inline: true },
        { name: "Type", value: ev.event_type || "event", inline: true },
        { name: "RSVP", value: url },
      ],
    }],
  });
}

async function listPotlucks(db: D1Database, siteUrl: string) {
  const rows: any[] = ((await db
    .prepare("SELECT id, title, date_label, time_label, location FROM potlucks WHERE status='upcoming' ORDER BY id DESC LIMIT 5")
    .all())?.results) || [];

  if (rows.length === 0) {
    return reply(`No upcoming potlucks. ${siteUrl}/potlucks`);
  }

  return reply("", {
    embeds: [{
      title: "Upcoming potlucks",
      url: `${siteUrl}/potlucks`,
      color: ACCENT,
      fields: rows.map((p) => ({
        name: `${p.date_label || "TBD"} — ${p.title}`,
        value: `${p.time_label || ""} · ${p.location || "Denver"}\n${siteUrl}/potlucks/${p.id}`.trim(),
      })),
    }],
  });
}

function siteLinks(siteUrl: string) {
  return reply("", {
    embeds: [{
      title: "Denver Social Nights",
      url: siteUrl,
      description: "Community-voted social events around Denver.",
      color: ACCENT,
      fields: [
        { name: "Events", value: `${siteUrl}/events`, inline: true },
        { name: "Potlucks", value: `${siteUrl}/potlucks`, inline: true },
        { name: "About", value: `${siteUrl}/about`, inline: true },
        { name: "Contact", value: `${siteUrl}/contact`, inline: true },
      ],
    }],
  });
}

export const POST = async ({ request }: { request: Request }) => {
  const publicKey = (env as any).DISCORD_PUBLIC_KEY as string | undefined;
  if (!publicKey) {
    return new Response("DISCORD_PUBLIC_KEY not set", { status: 500 });
  }

  const sig = request.headers.get("x-signature-ed25519");
  const ts = request.headers.get("x-signature-timestamp");
  const raw = await request.text();

  const ok = await verifyDiscordSignature(raw, sig, ts, publicKey);
  if (!ok) return new Response("invalid request signature", { status: 401 });

  let body: any;
  try { body = JSON.parse(raw); } catch {
    return new Response("bad json", { status: 400 });
  }

  if (body.type === InteractionType.PING) {
    return json({ type: InteractionResponseType.PONG });
  }

  if (body.type !== InteractionType.APPLICATION_COMMAND) {
    return reply("Unsupported interaction.", { ephemeral: true });
  }

  const siteUrl = siteUrlFrom(request, env);
  const db = getDB();
  const cmd = body.data?.name as string;
  const opts = optMap(body.data?.options);

  if (cmd === "denver" || cmd === "site") {
    return siteLinks(siteUrl);
  }

  if (!db) return reply("Database unavailable right now.", { ephemeral: true });

  if (cmd === "events") return listEvents(db, siteUrl);
  if (cmd === "potlucks") return listPotlucks(db, siteUrl);
  if (cmd === "event") {
    const id = parseInt(opts.id);
    if (!id) return reply("Usage: `/event id:<number>`", { ephemeral: true });
    return eventDetail(db, siteUrl, id);
  }

  return reply(`Unknown command: ${cmd}`, { ephemeral: true });
};

// Discord requires a 200 to the GET verification check some clients do; harmless.
export const GET = async () => new Response("Denver Social Hub Discord interactions endpoint", { status: 200 });
