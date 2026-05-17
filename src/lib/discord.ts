// Discord HTTP-interactions helpers.
// Workers can't hold a gateway WebSocket; Discord pushes every slash command
// to our endpoint, and we verify it with the application's Ed25519 public key.

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
} as const;

// EPHEMERAL flag — only the invoking user sees the reply.
export const MessageFlags = { EPHEMERAL: 1 << 6 } as const;

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export async function verifyDiscordSignature(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): Promise<boolean> {
  if (!signatureHex || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKeyHex),
      { name: "Ed25519" } as any,
      false,
      ["verify"],
    );
    const data = new TextEncoder().encode(timestamp + rawBody);
    return await crypto.subtle.verify("Ed25519", key, hexToBytes(signatureHex), data);
  } catch {
    return false;
  }
}

export function siteUrlFrom(request: Request, envObj: unknown): string {
  const envUrl = (envObj as any)?.PUBLIC_SITE_URL;
  if (typeof envUrl === "string" && envUrl) return envUrl.replace(/\/$/, "");
  try {
    const u = new URL(request.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://denversocialhub.com";
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function reply(content: string, opts: { ephemeral?: boolean; embeds?: any[] } = {}): Response {
  return json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      embeds: opts.embeds,
      flags: opts.ephemeral ? MessageFlags.EPHEMERAL : 0,
      allowed_mentions: { parse: [] },
    },
  });
}
