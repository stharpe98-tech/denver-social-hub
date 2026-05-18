// Shared cascade-delete logic for /u/<slug> profiles.
// Used by both /api/admin/profile-delete (single) and
// /api/admin/profile-bulk-delete (many).
//
// Cascade behavior matches profile-delete.ts:
//   - Deletes profile row
//   - Deletes profile_codes, profile_reports
//   - Deletes bookable_offerings + their offering_availability + offering_blackouts
//   - Deletes bookings tied to the profile
//   - Deletes R2 images (cover_photo_url + avatar_photo_url)
//   - Anonymizes favors/events by clearing member_email/submitted_by_email
//
// Errors are captured (non-fatal) so a partial DB state still gets cleaned
// up as much as possible.

export function r2KeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /\/api\/profile\/img\/(u\/[A-Za-z0-9_\-\/.]+)$/.exec(url);
  return m ? m[1] : null;
}

export interface CascadeResult {
  ok: boolean;
  slug: string;
  errors: string[];
  notFound?: boolean;
}

export async function cascadeDeleteProfile(
  db: D1Database,
  env: any,
  slug: string,
): Promise<CascadeResult> {
  const errors: string[] = [];

  let profile: any = null;
  try {
    profile = await db.prepare(
      `SELECT slug, email, cover_photo_url, avatar_photo_url FROM profiles WHERE slug = ?`
    ).bind(slug).first();
  } catch {
    profile = await db.prepare(`SELECT slug, email FROM profiles WHERE slug = ?`).bind(slug).first();
  }
  if (!profile) return { ok: false, slug, errors: [], notFound: true };

  // R2 cleanup
  try {
    const uploads: any = env?.UPLOADS;
    if (uploads) {
      for (const url of [profile.cover_photo_url, profile.avatar_photo_url]) {
        const key = r2KeyFromUrl(url);
        if (key) {
          try { await uploads.delete(key); }
          catch (e: any) { errors.push(`r2 ${key}: ${e?.message || 'err'}`); }
        }
      }
    }
  } catch (e: any) { errors.push(`r2 lookup: ${e?.message || 'err'}`); }

  async function safeRun(sql: string, ...binds: any[]) {
    try { await db.prepare(sql).bind(...binds).run(); }
    catch (e: any) { errors.push(`${sql.slice(0, 40)}…: ${e?.message || 'err'}`); }
  }

  await safeRun(`DELETE FROM profile_codes WHERE slug = ?`, slug);
  await safeRun(`DELETE FROM profile_reports WHERE slug = ?`, slug);

  try {
    const offerings = (await db.prepare(
      `SELECT id FROM bookable_offerings WHERE profile_slug = ?`
    ).bind(slug).all())?.results || [];
    const ids = (offerings as any[]).map(o => o.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      await safeRun(`DELETE FROM offering_availability WHERE offering_id IN (${placeholders})`, ...ids);
      await safeRun(`DELETE FROM offering_blackouts WHERE offering_id IN (${placeholders})`, ...ids);
    }
  } catch (e: any) { errors.push(`offerings lookup: ${e?.message || 'err'}`); }
  await safeRun(`DELETE FROM bookings WHERE profile_slug = ?`, slug);
  await safeRun(`DELETE FROM bookable_offerings WHERE profile_slug = ?`, slug);

  const email = (profile.email || '').toLowerCase();
  if (email) {
    await safeRun(`UPDATE favors SET member_email = '' WHERE LOWER(member_email) = ?`, email);
    await safeRun(`UPDATE events SET submitted_by_email = '' WHERE LOWER(submitted_by_email) = ?`, email);
  }

  await safeRun(`DELETE FROM profiles WHERE slug = ?`, slug);

  return { ok: true, slug, errors };
}

/** Clear both photo URLs on a profile + delete the R2 objects. */
export async function clearProfilePhotos(
  db: D1Database,
  env: any,
  slug: string,
): Promise<{ ok: boolean; errors: string[]; notFound?: boolean }> {
  const errors: string[] = [];
  let profile: any = null;
  try {
    profile = await db.prepare(
      `SELECT slug, cover_photo_url, avatar_photo_url FROM profiles WHERE slug = ?`
    ).bind(slug).first();
  } catch (e: any) { errors.push(`lookup: ${e?.message || 'err'}`); }
  if (!profile) return { ok: false, errors, notFound: true };

  try {
    const uploads: any = env?.UPLOADS;
    if (uploads) {
      for (const url of [profile.cover_photo_url, profile.avatar_photo_url]) {
        const key = r2KeyFromUrl(url);
        if (key) {
          try { await uploads.delete(key); }
          catch (e: any) { errors.push(`r2 ${key}: ${e?.message || 'err'}`); }
        }
      }
    }
  } catch (e: any) { errors.push(`r2 lookup: ${e?.message || 'err'}`); }

  try {
    await db.prepare(
      `UPDATE profiles SET cover_photo_url = NULL, avatar_photo_url = NULL WHERE slug = ?`
    ).bind(slug).run();
  } catch (e: any) { errors.push(`update: ${e?.message || 'err'}`); }

  return { ok: true, errors };
}
