#!/usr/bin/env node
// One-shot script: register/update slash commands with Discord.
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-discord-commands.mjs
// Optional: DISCORD_GUILD_ID=... to register guild-scoped (instant) instead of global (~1h propagation).

const appId = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!appId || !token) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN in your environment.");
  process.exit(1);
}

const commands = [
  { name: "denver", description: "Link to the Denver Social Hub site" },
  { name: "site",   description: "Quick links to the main site sections" },
  { name: "events", description: "Show upcoming Denver Social Nights events" },
  { name: "potlucks", description: "Show upcoming potlucks" },
  {
    name: "event",
    description: "Show details for one event",
    options: [
      { name: "id", description: "Event id", type: 4 /* INTEGER */, required: true },
    ],
  },
];

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    "Authorization": `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error("Failed:", res.status, await res.text());
  process.exit(1);
}
console.log(`Registered ${commands.length} commands (${guildId ? "guild" : "global"}).`);
