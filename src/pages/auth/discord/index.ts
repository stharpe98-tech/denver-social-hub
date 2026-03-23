import { env } from "cloudflare:workers";

export const GET = async ({ request }: { request: Request }) => {
  const clientId = (env as any).DISCORD_CLIENT_ID;
  const redirectUri = new URL(request.url).origin + "/auth/discord/callback";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify email",
  });

  return Response.redirect(`https://discord.com/oauth2/authorize?${params}`, 302);
};
