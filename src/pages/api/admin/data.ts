import type { APIContext } from 'astro';
import { getDB } from '../../../lib/db';

export const prerender = false;

function isAdmin(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/dsn_user=([^;]+)/);
  if (!m) return false;
  try { return JSON.parse(decodeURIComponent(m[1])).email === 'stharpe98@gmail.com'; } catch { return false; }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// GET /api/admin/data?table=xxx — fetch data from various tables
export async function GET({ request }: APIContext) {
  if (!isAdmin(request)) return json({ error: 'Unauthorized' }, 401);
  const db = getDB();
  if (!db) return json({ error: 'DB unavailable' }, 500);
  const url = new URL(request.url);
  const table = url.searchParams.get('table');

  try {
    // Overview stats — returns aggregate counts for the dashboard
    if (table === 'overview') {
      const [members, events, rsvps, suggestions, announcements, spotlights, reports, partners, restaurants, deposits, pages, plugins, emailLog, pageViews] = await Promise.all([
        db.prepare(`SELECT COUNT(*) as c FROM members`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM events`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM event_rsvps`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM suggestions`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM announcements`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM member_spotlights`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM member_reports WHERE status='pending'`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM partners`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM restaurants`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM deposits`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM custom_pages`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM plugins`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM email_log`).first(),
        db.prepare(`SELECT COUNT(*) as c FROM page_views`).first(),
      ]);
      const memberStats = await db.prepare(`SELECT COUNT(CASE WHEN onboarding_done=1 THEN 1 END) as onboarded, COUNT(CASE WHEN suspended=1 THEN 1 END) as suspended, COUNT(CASE WHEN approved=0 AND onboarding_done=1 THEN 1 END) as pending_approval FROM members`).first() as any;
      const eventStats = await db.prepare(`SELECT COUNT(CASE WHEN featured=1 THEN 1 END) as featured, COUNT(CASE WHEN is_past=0 THEN 1 END) as upcoming, COUNT(CASE WHEN is_past=1 THEN 1 END) as past FROM events`).first() as any;
      return json({
        members: (members as any)?.c || 0,
        onboarded: memberStats?.onboarded || 0,
        suspended: memberStats?.suspended || 0,
        pending_approval: memberStats?.pending_approval || 0,
        events: (events as any)?.c || 0,
        featured_events: eventStats?.featured || 0,
        upcoming_events: eventStats?.upcoming || 0,
        past_events: eventStats?.past || 0,
        rsvps: (rsvps as any)?.c || 0,
        suggestions: (suggestions as any)?.c || 0,
        announcements: (announcements as any)?.c || 0,
        spotlights: (spotlights as any)?.c || 0,
        pending_reports: (reports as any)?.c || 0,
        partners: (partners as any)?.c || 0,
        restaurants: (restaurants as any)?.c || 0,
        deposits: (deposits as any)?.c || 0,
        custom_pages: (pages as any)?.c || 0,
        plugins: (plugins as any)?.c || 0,
        emails_sent: (emailLog as any)?.c || 0,
        page_views: (pageViews as any)?.c || 0,
      });
    }

    // Analytics — time series data
    if (table === 'analytics') {
      const membersByMonth = (await db.prepare(`SELECT strftime('%Y-%m', joined_at) as month, COUNT(*) as count FROM members WHERE joined_at IS NOT NULL GROUP BY month ORDER BY month`).all())?.results || [];
      const eventsByType = (await db.prepare(`SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type ORDER BY count DESC`).all())?.results || [];
      const rsvpsByMonth = (await db.prepare(`SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count FROM event_rsvps WHERE created_at IS NOT NULL GROUP BY month ORDER BY month`).all())?.results || [];
      const topEvents = (await db.prepare(`SELECT e.title, e.event_type, COUNT(r.id) as rsvp_count FROM events e LEFT JOIN event_rsvps r ON e.id = r.event_id GROUP BY e.id ORDER BY rsvp_count DESC LIMIT 10`).all())?.results || [];
      const viewsByPath = (await db.prepare(`SELECT path, COUNT(*) as count FROM page_views GROUP BY path ORDER BY count DESC LIMIT 10`).all())?.results || [];
      const ratingsByEvent = (await db.prepare(`SELECT e.title, ROUND(AVG(r.rating),1) as avg_rating, COUNT(r.id) as num_ratings FROM event_ratings r JOIN events e ON e.id=r.event_id GROUP BY r.event_id ORDER BY avg_rating DESC LIMIT 10`).all())?.results || [];
      return json({ membersByMonth, eventsByType, rsvpsByMonth, topEvents, viewsByPath, ratingsByEvent });
    }

    // Members
    if (table === 'members') {
      const rows = (await db.prepare(`SELECT * FROM members ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Events with RSVP counts
    if (table === 'events') {
      const rows = (await db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id) as live_rsvp_count FROM events e ORDER BY e.id DESC`).all())?.results || [];
      return json(rows);
    }

    // RSVPs for a specific event
    if (table === 'rsvps') {
      const eventId = url.searchParams.get('event_id');
      if (!eventId) return json({ error: 'Missing event_id' }, 400);
      const rows = (await db.prepare(`SELECT * FROM event_rsvps WHERE event_id=? ORDER BY created_at`).bind(parseInt(eventId)).all())?.results || [];
      return json(rows);
    }

    // Suggestions
    if (table === 'suggestions') {
      const rows = (await db.prepare(`SELECT * FROM suggestions ORDER BY votes DESC`).all())?.results || [];
      return json(rows);
    }

    // Announcements
    if (table === 'announcements') {
      const rows = (await db.prepare(`SELECT * FROM announcements ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Spotlights
    if (table === 'spotlights') {
      const rows = (await db.prepare(`SELECT * FROM member_spotlights ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Member reports
    if (table === 'reports') {
      const rows = (await db.prepare(`SELECT * FROM member_reports ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Partners
    if (table === 'partners') {
      const rows = (await db.prepare(`SELECT * FROM partners ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Partner inquiries
    if (table === 'partner_inquiries') {
      const rows = (await db.prepare(`SELECT * FROM partner_inquiries ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Restaurants
    if (table === 'restaurants') {
      const rows = (await db.prepare(`SELECT * FROM restaurants ORDER BY name`).all())?.results || [];
      return json(rows);
    }

    // Custom pages
    if (table === 'pages') {
      const rows = (await db.prepare(`SELECT * FROM custom_pages ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Plugins
    if (table === 'plugins') {
      const rows = (await db.prepare(`SELECT * FROM plugins ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Deposits
    if (table === 'deposits') {
      const rows = (await db.prepare(`SELECT d.*, e.title as event_title FROM deposits d LEFT JOIN events e ON d.event_id=e.id ORDER BY d.id DESC`).all())?.results || [];
      return json(rows);
    }

    // Email log
    if (table === 'email_log') {
      const rows = (await db.prepare(`SELECT * FROM email_log ORDER BY id DESC LIMIT 100`).all())?.results || [];
      return json(rows);
    }

    // Referrals
    if (table === 'referrals') {
      const rows = (await db.prepare(`SELECT * FROM referrals ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Safety checkins
    if (table === 'safety') {
      const rows = (await db.prepare(`SELECT * FROM safety_checkins ORDER BY id DESC`).all())?.results || [];
      return json(rows);
    }

    // Settings
    if (table === 'settings') {
      const rows = (await db.prepare(`SELECT key, value FROM settings`).all())?.results || [];
      const settings: Record<string, string> = {};
      for (const r of rows as any[]) settings[r.key] = r.value;
      return json(settings);
    }

    return json({ error: 'Unknown table' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}

// POST /api/admin/data — perform actions
export async function POST({ request }: APIContext) {
  if (!isAdmin(request)) return json({ error: 'Unauthorized' }, 401);
  const db = getDB();
  if (!db) return json({ error: 'DB unavailable' }, 500);

  try {
    const body = await request.json() as any;
    const { table, action } = body;

    // ─── MEMBER ACTIONS ───
    if (table === 'members') {
      if (action === 'delete') {
        await db.prepare(`DELETE FROM members WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'approve') {
        await db.prepare(`UPDATE members SET approved=1, approved_at=datetime('now'), approved_by='admin' WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'suspend') {
        await db.prepare(`UPDATE members SET suspended=1, suspended_reason=? WHERE id=?`).bind(body.reason || 'Admin action', body.id).run();
        return json({ ok: true });
      }
      if (action === 'unsuspend') {
        await db.prepare(`UPDATE members SET suspended=0, suspended_reason='', no_show_count=0 WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'update') {
        await db.prepare(`UPDATE members SET name=?, bio=?, neighborhood=?, role=?, email=? WHERE id=?`)
          .bind(body.name || '', body.bio || '', body.neighborhood || '', body.role || 'member', body.email || '', body.id).run();
        return json({ ok: true });
      }
      if (action === 'update_role') {
        await db.prepare(`UPDATE members SET role=? WHERE id=?`).bind(body.role || 'member', body.id).run();
        return json({ ok: true });
      }
      if (action === 'reset_noshows') {
        await db.prepare(`UPDATE members SET no_show_count=0 WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'clear_pending') {
        await db.prepare(`DELETE FROM members WHERE onboarding_done=0 OR onboarding_done IS NULL`).run();
        return json({ ok: true });
      }
      if (action === 'bulk_approve') {
        const ids = body.ids as number[];
        if (ids?.length) {
          const stmts = ids.map(id => db.prepare(`UPDATE members SET approved=1, approved_at=datetime('now'), approved_by='admin' WHERE id=?`).bind(id));
          await db.batch(stmts);
        }
        return json({ ok: true });
      }
      if (action === 'bulk_delete') {
        const ids = body.ids as number[];
        if (ids?.length) {
          const stmts = ids.map(id => db.prepare(`DELETE FROM members WHERE id=?`).bind(id));
          await db.batch(stmts);
        }
        return json({ ok: true });
      }
    }

    // ─── EVENT ACTIONS ───
    if (table === 'events') {
      if (action === 'create') {
        await db.prepare(`INSERT INTO events (title,event_type,location,zone,event_month,event_day,spots,price_cap,description,featured,plus_one_allowed,difficulty,pet_friendly,cell_service,packing_list,reservation_by,price_per_person,payment_link,min_group_size,deposit_required,deposit_amount,commit_deadline,potluck_categories) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(
            body.title, body.event_type||'social', body.location||'', body.zone||'', body.event_month||'', body.event_day||'',
            parseInt(body.spots)||10, body.price_cap||'', body.description||'', body.featured?1:0,
            body.plus_one_allowed!==undefined?parseInt(body.plus_one_allowed):1,
            body.difficulty||'', body.pet_friendly?1:0, body.cell_service||'', body.packing_list||'',
            body.reservation_by||'', body.price_per_person||'', body.payment_link||'',
            parseInt(body.min_group_size)||0, body.deposit_required?1:0,
            parseFloat(body.deposit_amount)||10, body.commit_deadline||'',
            body.potluck_categories||'Appetizers,Mains,Sides,Desserts,Drinks'
          ).run();
        return json({ ok: true });
      }
      if (action === 'update') {
        await db.prepare(`UPDATE events SET title=?,event_type=?,location=?,zone=?,event_month=?,event_day=?,spots=?,price_cap=?,description=?,featured=?,plus_one_allowed=?,difficulty=?,pet_friendly=?,cell_service=?,packing_list=?,reservation_by=?,price_per_person=?,payment_link=?,deposit_required=?,deposit_amount=?,commit_deadline=? WHERE id=?`)
          .bind(
            body.title, body.event_type||'social', body.location||'', body.zone||'', body.event_month||'', body.event_day||'',
            parseInt(body.spots)||10, body.price_cap||'', body.description||'', body.featured?1:0,
            body.plus_one_allowed!==undefined?parseInt(body.plus_one_allowed):1,
            body.difficulty||'', body.pet_friendly?1:0, body.cell_service||'', body.packing_list||'',
            body.reservation_by||'', body.price_per_person||'', body.payment_link||'',
            body.deposit_required?1:0, parseFloat(body.deposit_amount)||10, body.commit_deadline||'',
            body.id
          ).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM events WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'feature') {
        await db.prepare(`UPDATE events SET featured=? WHERE id=?`).bind(body.featured?1:0, body.id).run();
        return json({ ok: true });
      }
      if (action === 'archive') {
        await db.prepare(`UPDATE events SET is_past=1 WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'archive_past') {
        await db.prepare(`UPDATE events SET is_past=1 WHERE is_past=0`).run();
        return json({ ok: true });
      }
      if (action === 'remove_rsvp') {
        await db.prepare(`DELETE FROM event_rsvps WHERE id=?`).bind(body.rsvp_id).run();
        return json({ ok: true });
      }
    }

    // ─── SUGGESTION ACTIONS ───
    if (table === 'suggestions') {
      if (action === 'status') {
        await db.prepare(`UPDATE suggestions SET status=? WHERE id=?`).bind(body.status, body.id).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM suggestions WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'promote') {
        // Get the suggestion, then create an event from it
        const s = await db.prepare(`SELECT * FROM suggestions WHERE id=?`).bind(body.id).first() as any;
        if (s) {
          await db.prepare(`INSERT INTO events (title, description, event_type, submitted_by, promoted_from_suggestion) VALUES (?, ?, 'social', ?, 1)`)
            .bind(s.title, s.description || '', s.member_name || 'Community').run();
          await db.prepare(`UPDATE suggestions SET status='promoted', promoted=1 WHERE id=?`).bind(body.id).run();
        }
        return json({ ok: true });
      }
    }

    // ─── ANNOUNCEMENT ACTIONS ───
    if (table === 'announcements') {
      if (action === 'create') {
        await db.prepare(`INSERT INTO announcements (text) VALUES (?)`).bind(body.text).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM announcements WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
    }

    // ─── SPOTLIGHT ACTIONS ───
    if (table === 'spotlights') {
      if (action === 'create') {
        await db.prepare(`INSERT INTO member_spotlights (member_email, blurb, week_of) VALUES (?,?,?)`)
          .bind(body.member_email, body.blurb, body.week_of).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM member_spotlights WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
    }

    // ─── REPORT ACTIONS ───
    if (table === 'reports') {
      if (action === 'resolve') {
        await db.prepare(`UPDATE member_reports SET status='resolved' WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'dismiss') {
        await db.prepare(`UPDATE member_reports SET status='dismissed' WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM member_reports WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
    }

    // ─── PARTNER ACTIONS ───
    if (table === 'partners') {
      if (action === 'create') {
        await db.prepare(`INSERT INTO partners (business_name, neighborhood, category, deal, how_to_claim, website, logo_emoji, promo_code) VALUES (?,?,?,?,?,?,?,?)`)
          .bind(body.business_name, body.neighborhood||'', body.category||'', body.deal, body.how_to_claim||'', body.website||'', body.logo_emoji||'🤝', body.promo_code||'').run();
        return json({ ok: true });
      }
      if (action === 'update') {
        await db.prepare(`UPDATE partners SET business_name=?, neighborhood=?, category=?, deal=?, how_to_claim=?, website=?, logo_emoji=?, promo_code=?, active=? WHERE id=?`)
          .bind(body.business_name, body.neighborhood||'', body.category||'', body.deal, body.how_to_claim||'', body.website||'', body.logo_emoji||'🤝', body.promo_code||'', body.active?1:0, body.id).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM partners WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
    }

    // ─── RESTAURANT ACTIONS ───
    if (table === 'restaurants') {
      if (action === 'create') {
        await db.prepare(`INSERT INTO restaurants (name, zone, category, address, price_range, rating, notes, phone, hours) VALUES (?,?,?,?,?,?,?,?,?)`)
          .bind(body.name, body.zone||'', body.category||'', body.address||'', body.price_range||'$$', parseFloat(body.rating)||0, body.notes||'', body.phone||'', body.hours||'').run();
        return json({ ok: true });
      }
      if (action === 'update') {
        await db.prepare(`UPDATE restaurants SET name=?, zone=?, category=?, address=?, price_range=?, rating=?, notes=?, phone=?, hours=? WHERE id=?`)
          .bind(body.name, body.zone||'', body.category||'', body.address||'', body.price_range||'$$', parseFloat(body.rating)||0, body.notes||'', body.phone||'', body.hours||'', body.id).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM restaurants WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
    }

    // ─── CUSTOM PAGE ACTIONS ───
    if (table === 'pages') {
      if (action === 'create') {
        await db.prepare(`INSERT INTO custom_pages (slug, title, content, show_in_nav, nav_label, published) VALUES (?,?,?,?,?,?)`)
          .bind(body.slug, body.title, body.content||'', body.show_in_nav?1:0, body.nav_label||'', body.published?1:0).run();
        return json({ ok: true });
      }
      if (action === 'update') {
        await db.prepare(`UPDATE custom_pages SET slug=?, title=?, content=?, show_in_nav=?, nav_label=?, published=? WHERE id=?`)
          .bind(body.slug, body.title, body.content||'', body.show_in_nav?1:0, body.nav_label||'', body.published?1:0, body.id).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM custom_pages WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
    }

    // ─── PLUGIN ACTIONS ───
    if (table === 'plugins') {
      if (action === 'create') {
        await db.prepare(`INSERT INTO plugins (name, description, type, code, location, enabled) VALUES (?,?,?,?,?,?)`)
          .bind(body.name, body.description||'', body.type||'script', body.code, body.location||'head', body.enabled?1:0).run();
        return json({ ok: true });
      }
      if (action === 'update') {
        await db.prepare(`UPDATE plugins SET name=?, description=?, type=?, code=?, location=?, enabled=? WHERE id=?`)
          .bind(body.name, body.description||'', body.type||'script', body.code, body.location||'head', body.enabled?1:0, body.id).run();
        return json({ ok: true });
      }
      if (action === 'toggle') {
        await db.prepare(`UPDATE plugins SET enabled=? WHERE id=?`).bind(body.enabled?1:0, body.id).run();
        return json({ ok: true });
      }
      if (action === 'delete') {
        await db.prepare(`DELETE FROM plugins WHERE id=?`).bind(body.id).run();
        return json({ ok: true });
      }
    }

    // ─── SETTINGS ───
    if (table === 'settings') {
      if (action === 'save') {
        const entries = Object.entries(body.settings || {});
        if (entries.length) {
          const stmts = entries.map(([key, value]) =>
            db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`)
              .bind(key, String(value))
          );
          await db.batch(stmts);
        }
        return json({ ok: true });
      }
    }

    return json({ error: 'Unknown table/action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
