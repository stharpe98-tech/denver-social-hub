export function buildConfirmationEmail(opts: {
  name: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventLocationDetail: string;
  dish: string;
  guests: number;
  editUrl: string;
  cancelUrl: string;
}): string {
  const { name, eventTitle, eventDate, eventTime, eventLocation, eventLocationDetail, dish, guests, editUrl, cancelUrl } = opts;
  const firstName = name.split(' ')[0];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>You're signed up — ${eventTitle}</title></head>
<body style="margin:0;padding:0;background:#f7f5f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f2;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#c2410c,#f77f00);padding:36px 32px;text-align:center;">
    <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Denver Social Community</div>
    <div style="font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">You're signed up! 🎉</div>
    <div style="font-size:15px;color:rgba(255,255,255,0.88);margin-top:8px;">${eventTitle}</div>
  </td></tr>

  <!-- Event details -->
  <tr><td style="padding:28px 32px 0;">
    <div style="font-size:13px;font-weight:700;color:#a09890;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Event Details</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ede8;">
          <span style="font-size:15px;color:#a09890;margin-right:12px;">📅</span>
          <span style="font-size:15px;color:#1c1917;font-weight:500;">${eventDate}${eventTime ? ' · ' + eventTime : ''}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ede8;">
          <span style="font-size:15px;color:#a09890;margin-right:12px;">📍</span>
          <span style="font-size:15px;color:#1c1917;font-weight:500;">${eventLocation}${eventLocationDetail ? ' · ' + eventLocationDetail : ''}</span>
        </td>
      </tr>
      ${guests > 1 ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0ede8;">
        <span style="font-size:15px;color:#a09890;margin-right:12px;">👥</span>
        <span style="font-size:15px;color:#1c1917;font-weight:500;">You + ${guests - 1} other${guests > 2 ? 's' : ''}</span>
      </td></tr>` : ''}
    </table>
  </td></tr>

  <!-- What you're bringing -->
  ${dish ? `<tr><td style="padding:24px 32px 0;">
    <div style="background:#fff8ec;border:1.5px solid #fcd5a0;border-radius:12px;padding:18px 20px;">
      <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">You're bringing</div>
      <div style="font-size:20px;font-weight:700;color:#c2410c;">🍽 ${dish}</div>
    </div>
  </td></tr>` : ''}

  <!-- Manage buttons -->
  <tr><td style="padding:28px 32px;">
    <div style="font-size:13px;color:#a09890;margin-bottom:14px;">Need to make a change? No problem.</div>
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-right:8px;">
          <a href="${editUrl}" style="display:block;background:#f77f00;color:#ffffff;font-size:15px;font-weight:600;text-align:center;padding:13px 20px;border-radius:10px;text-decoration:none;">Edit my sign-up</a>
        </td>
        <td style="padding-left:8px;">
          <a href="${cancelUrl}" style="display:block;background:#ffffff;color:#57524c;font-size:15px;font-weight:500;text-align:center;padding:13px 20px;border-radius:10px;border:1.5px solid #e4ddd4;text-decoration:none;">Cancel my spot</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f7f5f2;padding:20px 32px;text-align:center;border-top:1px solid #e4ddd4;">
    <div style="font-size:12px;color:#a09890;line-height:1.6;">
      Denver Social Community · No ads, ever.<br/>
      You're getting this because you signed up for ${eventTitle}.<br/>
      <a href="${cancelUrl}" style="color:#f77f00;text-decoration:none;">Cancel my spot</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildReminderEmail(opts: {
  name: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventLocationDetail: string;
  dish: string;
  editUrl: string;
}): string {
  const { name, eventTitle, eventDate, eventTime, eventLocation, eventLocationDetail, dish, editUrl } = opts;
  const firstName = name.split(' ')[0];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Tomorrow: ${eventTitle}</title></head>
<body style="margin:0;padding:0;background:#f7f5f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f2;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#c2410c,#f77f00);padding:36px 32px;text-align:center;">
    <div style="font-size:40px;margin-bottom:10px;">⏰</div>
    <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;">Heads up, ${firstName}!</div>
    <div style="font-size:15px;color:rgba(255,255,255,0.88);margin-top:6px;">${eventTitle} is tomorrow</div>
  </td></tr>

  <!-- Details -->
  <tr><td style="padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0ede8;">
        <span style="font-size:15px;color:#a09890;margin-right:12px;">📅</span>
        <span style="font-size:15px;color:#1c1917;font-weight:500;">${eventDate}${eventTime ? ' · ' + eventTime : ''}</span>
      </td></tr>
      <tr><td style="padding:8px 0;">
        <span style="font-size:15px;color:#a09890;margin-right:12px;">📍</span>
        <span style="font-size:15px;color:#1c1917;font-weight:500;">${eventLocation}${eventLocationDetail ? ' · ' + eventLocationDetail : ''}</span>
      </td></tr>
    </table>

    ${dish ? `<div style="background:#fff8ec;border:1.5px solid #fcd5a0;border-radius:12px;padding:16px 18px;margin-top:20px;">
      <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Don't forget — you're bringing</div>
      <div style="font-size:18px;font-weight:700;color:#c2410c;">🍽 ${dish}</div>
    </div>` : ''}

    <div style="text-align:center;margin-top:24px;">
      <a href="${editUrl}" style="display:inline-block;background:#f77f00;color:#ffffff;font-size:15px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none;">View my sign-up</a>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f7f5f2;padding:20px 32px;text-align:center;border-top:1px solid #e4ddd4;">
    <div style="font-size:12px;color:#a09890;">Denver Social Community · No ads, ever.</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
