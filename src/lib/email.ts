// Shared, email-safe template system for all Denver Social transactional mail.
//
// Email clients are stuck in 2005: no flexbox, no grid, no external fonts,
// inconsistent <style> support. So everything here is tables + inline styles
// with a web-safe font stack. One branded shell (`emailShell`) wraps every
// message so confirmations, reminders, and codes all look like one product.

const BRAND = {
  canvas: '#FBF7F0',     // warm cream page background
  card: '#FFFFFF',
  ink: '#1C1917',        // near-black warm
  inkSoft: '#57534E',    // body gray
  inkFaint: '#A8A29E',   // captions
  border: '#EAE2D6',     // warm hairline
  accent: '#C2724B',     // terracotta
  accentInk: '#8B4727',  // darker terracotta for text on tint
  accentTint: '#FBF3EF', // terracotta wash
  accentTintBorder: '#F0DAC9',
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
};

type Button = { label: string; href: string; primary?: boolean };

/** The branded wrapper. `bodyHtml` is dropped between header and footer. */
export function emailShell(opts: {
  preheader?: string;          // hidden inbox-preview text
  eyebrow?: string;            // small uppercase label in header
  heading: string;             // big header line
  subheading?: string;         // line under heading
  emoji?: string;              // optional big emoji above heading
  bodyHtml: string;            // main content
  footerNote?: string;         // small line in footer (defaults to brand line)
}): string {
  const { preheader = '', eyebrow, heading, subheading, emoji, bodyHtml, footerNote } = opts;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="light only"/><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:${BRAND.font};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.canvas};font-size:1px;line-height:1px;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">

  <!-- Header -->
  <tr><td style="padding:36px 36px 28px;border-bottom:1px solid ${BRAND.border};">
    <div style="font-size:13px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.01em;">denver<span style="color:${BRAND.inkFaint};font-weight:400;">social</span>hub</div>
    ${emoji ? `<div style="font-size:40px;line-height:1;margin-top:20px;">${emoji}</div>` : ''}
    ${eyebrow ? `<div style="font-size:11px;font-weight:700;color:${BRAND.accent};letter-spacing:1.5px;text-transform:uppercase;margin-top:${emoji ? '14px' : '20px'};">${escapeHtml(eyebrow)}</div>` : ''}
    <div style="font-size:26px;font-weight:800;color:${BRAND.ink};line-height:1.15;letter-spacing:-0.02em;margin-top:8px;">${escapeHtml(heading)}</div>
    ${subheading ? `<div style="font-size:15px;color:${BRAND.inkSoft};line-height:1.5;margin-top:8px;">${escapeHtml(subheading)}</div>` : ''}
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 36px;">${bodyHtml}</td></tr>

  <!-- Footer -->
  <tr><td style="background:${BRAND.canvas};padding:22px 36px;text-align:center;border-top:1px solid ${BRAND.border};">
    <div style="font-size:12px;color:${BRAND.inkFaint};line-height:1.7;">
      ${footerNote ? escapeHtml(footerNote) + '<br/>' : ''}
      Denver Social · made by neighbors · no ads, ever.
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

/** Renders a row of 1–2 buttons (email-safe, table-based). */
function buttonRow(buttons: Button[]): string {
  if (!buttons.length) return '';
  const cells = buttons.map((b) => {
    const style = b.primary
      ? `display:block;background:${BRAND.ink};color:#fff;font-size:15px;font-weight:600;text-align:center;padding:13px 22px;border-radius:10px;text-decoration:none;`
      : `display:block;background:${BRAND.card};color:${BRAND.ink};font-size:15px;font-weight:500;text-align:center;padding:13px 22px;border-radius:10px;border:1px solid ${BRAND.border};text-decoration:none;`;
    return `<td style="padding:0 4px;"><a href="${b.href}" style="${style}">${escapeHtml(b.label)}</a></td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>${cells}</tr></table>`;
}

/** Renders a detail row block (📅 / 📍 / 👥 style). */
function detailRows(rows: Array<{ icon: string; text: string }>): string {
  const items = rows.filter((r) => r.text).map((r, i, arr) =>
    `<tr><td style="padding:10px 0;${i < arr.length - 1 ? `border-bottom:1px solid ${BRAND.border};` : ''}">
      <span style="font-size:15px;margin-right:12px;">${r.icon}</span>
      <span style="font-size:15px;color:${BRAND.ink};font-weight:500;">${escapeHtml(r.text)}</span>
    </td></tr>`
  ).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>`;
}

/** A highlighted "you're bringing" callout box. */
function bringingBox(label: string, dish: string): string {
  if (!dish) return '';
  return `<div style="background:${BRAND.accentTint};border:1px solid ${BRAND.accentTintBorder};border-radius:12px;padding:16px 18px;margin-top:20px;">
    <div style="font-size:11px;font-weight:700;color:${BRAND.accentInk};text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">${escapeHtml(label)}</div>
    <div style="font-size:18px;font-weight:700;color:${BRAND.accent};">🍽 ${escapeHtml(dish)}</div>
  </div>`;
}

// ──────────────────────────────────────────────────────────────────────────
// Public builders
// ──────────────────────────────────────────────────────────────────────────

export function buildConfirmationEmail(opts: {
  name: string; eventTitle: string; eventDate: string; eventTime: string;
  eventLocation: string; eventLocationDetail: string; dish: string;
  guests: number; editUrl: string; cancelUrl: string;
}): string {
  const { name, eventTitle, eventDate, eventTime, eventLocation, eventLocationDetail, dish, guests, editUrl, cancelUrl } = opts;
  const body = `
    ${detailRows([
      { icon: '📅', text: `${eventDate}${eventTime ? ' · ' + eventTime : ''}` },
      { icon: '📍', text: `${eventLocation}${eventLocationDetail ? ' · ' + eventLocationDetail : ''}` },
      ...(guests > 1 ? [{ icon: '👥', text: `You + ${guests - 1} other${guests > 2 ? 's' : ''}` }] : []),
    ])}
    ${bringingBox("You're bringing", dish)}
    <div style="font-size:13px;color:${BRAND.inkFaint};margin:24px 0 0;">Need to make a change? No problem.</div>
    ${buttonRow([
      { label: 'Edit my sign-up', href: editUrl, primary: true },
      { label: 'Cancel my spot', href: cancelUrl },
    ])}`;
  return emailShell({
    preheader: `You're signed up for ${eventTitle}.`,
    eyebrow: "You're in 🎉",
    heading: eventTitle,
    subheading: `See you there, ${name.split(' ')[0] || 'friend'}.`,
    bodyHtml: body,
    footerNote: `You're getting this because you signed up for ${eventTitle}.`,
  });
}

export function buildReminderEmail(opts: {
  name: string; eventTitle: string; eventDate: string; eventTime: string;
  eventLocation: string; eventLocationDetail: string; dish: string; editUrl: string;
}): string {
  const { name, eventTitle, eventDate, eventTime, eventLocation, eventLocationDetail, dish, editUrl } = opts;
  const body = `
    ${detailRows([
      { icon: '📅', text: `${eventDate}${eventTime ? ' · ' + eventTime : ''}` },
      { icon: '📍', text: `${eventLocation}${eventLocationDetail ? ' · ' + eventLocationDetail : ''}` },
    ])}
    ${bringingBox("Don't forget — you're bringing", dish)}
    <div style="text-align:center;margin-top:24px;">
      <a href="${editUrl}" style="display:inline-block;background:${BRAND.ink};color:#fff;font-size:15px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none;">View my sign-up</a>
    </div>`;
  return emailShell({
    preheader: `${eventTitle} is tomorrow.`,
    emoji: '⏰',
    eyebrow: 'Tomorrow',
    heading: `Heads up, ${name.split(' ')[0] || 'friend'}!`,
    subheading: `${eventTitle} is tomorrow.`,
    bodyHtml: body,
  });
}

/** Generic 6-digit code email — for sign-in, admin, profile verification. */
export function buildCodeEmail(opts: {
  code: string;
  purpose?: string;        // e.g. "sign in", "verify your email"
  minutes?: number;        // expiry window
}): string {
  const { code, purpose = 'sign in', minutes = 10 } = opts;
  const body = `
    <div style="font-size:15px;color:${BRAND.inkSoft};line-height:1.6;margin-bottom:18px;">
      Use this code to ${escapeHtml(purpose)}. It expires in ${minutes} minutes.
    </div>
    <div style="background:${BRAND.accentTint};border:1px solid ${BRAND.accentTintBorder};border-radius:14px;padding:22px;text-align:center;">
      <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:${BRAND.accent};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(code)}</div>
    </div>
    <div style="font-size:13px;color:${BRAND.inkFaint};margin-top:18px;line-height:1.6;">
      Didn't request this? You can safely ignore this email — no one can act on it without the code above.
    </div>`;
  return emailShell({
    preheader: `Your code is ${code}`,
    eyebrow: 'One-time code',
    heading: 'Here’s your code',
    bodyHtml: body,
  });
}

export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
