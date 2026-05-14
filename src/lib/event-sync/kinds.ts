// Registry describing every supported source kind. The admin UI renders form
// fields from this list, the API validates incoming config against it, and the
// orchestrator dispatches to the right adapter by kind. Add a new source by
// appending an entry here + an adapter that reads from config.

export interface SyncFieldDef {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  required?: boolean;
  help?: string;
}

export interface SyncKindDef {
  kind: string;
  label: string;
  description: string;
  icon: string;
  fields: SyncFieldDef[];
  // True for kinds we pull on a schedule. Webhook is push-only.
  pullable: boolean;
  // Free-form note shown under the form (e.g. how to get credentials).
  note?: string;
  // Optional link to the third-party page where the user gets credentials.
  setupUrl?: string;
  setupLabel?: string;
}

export const SYNC_KINDS: SyncKindDef[] = [
  {
    kind: 'discord',
    label: 'Discord guild events',
    icon: '💬',
    description: "Pulls scheduled events from a Discord server your bot is in.",
    pullable: true,
    setupUrl: 'https://discord.com/developers/applications',
    setupLabel: 'Create / manage your bot',
    fields: [
      { name: 'guild_id', label: 'Guild ID', type: 'text', required: true, placeholder: '123456789012345678', help: 'Enable Developer Mode in Discord → right-click your server → Copy Server ID.' },
      { name: 'token', label: 'Bot token (optional)', type: 'password', help: 'Leave blank to use the DISCORD_BOT_TOKEN secret. Bot must be in the guild.' },
    ],
  },
  {
    kind: 'ics',
    label: 'iCalendar (ICS) feed',
    icon: '📅',
    description: 'Generic iCal/ICS feed. Works with Meetup public groups, Google Calendar (secret address), Apple Calendar, Eventbrite organizer iCal, and anything else that publishes ICS.',
    pullable: true,
    setupUrl: 'https://calendar.google.com/calendar/u/0/r/settings',
    setupLabel: 'Open Google Calendar settings',
    fields: [
      { name: 'url', label: 'ICS feed URL', type: 'url', required: true, placeholder: 'https://…/events.ics' },
    ],
  },
  {
    kind: 'eventbrite',
    label: 'Eventbrite',
    icon: '🎫',
    description: "Pulls upcoming events from an Eventbrite organization you own.",
    pullable: true,
    setupUrl: 'https://www.eventbrite.com/platform/api-keys',
    setupLabel: 'Get your Eventbrite API key',
    note: 'Get a private token at eventbrite.com → Account Settings → Developer Links → API keys. Find your organization ID at /v3/users/me/organizations/.',
    fields: [
      { name: 'token', label: 'Private API token', type: 'password', required: true, placeholder: 'XXXXXXXXXXXXXXXX' },
      { name: 'organization_id', label: 'Organization ID', type: 'text', required: true, placeholder: '123456789' },
    ],
  },
  {
    kind: 'luma',
    label: 'Luma (lu.ma)',
    icon: '✨',
    description: 'Pulls upcoming events from a Luma calendar.',
    pullable: true,
    setupUrl: 'https://lu.ma/manage/integrations',
    setupLabel: 'Create your Luma API key',
    note: 'Create an API key at lu.ma/manage/integrations. Find your calendar_api_id from your calendar settings page.',
    fields: [
      { name: 'api_key', label: 'Luma API key', type: 'password', required: true, placeholder: 'secret-xxxxxxxxx' },
      { name: 'calendar_api_id', label: 'Calendar API ID', type: 'text', required: true, placeholder: 'cal-xxxxxxxxxxxx' },
    ],
  },
  {
    kind: 'ticketmaster',
    label: 'Ticketmaster Discovery',
    icon: '🎟️',
    description: 'Pulls events near a city from the Ticketmaster Discovery API. Great for concerts, sports, and big public events.',
    pullable: true,
    setupUrl: 'https://developer.ticketmaster.com/products-and-docs/apis/getting-started/',
    setupLabel: 'Get your Ticketmaster API key',
    note: 'Get a free Consumer Key at developer.ticketmaster.com (Discovery API).',
    fields: [
      { name: 'apikey', label: 'Consumer key', type: 'password', required: true },
      { name: 'city', label: 'City', type: 'text', required: true, placeholder: 'Denver' },
      { name: 'state_code', label: 'State code (optional)', type: 'text', placeholder: 'CO' },
      { name: 'classification', label: 'Classification (optional)', type: 'text', placeholder: 'music, sports, arts…' },
    ],
  },
  {
    kind: 'facebook',
    label: 'Facebook Page events',
    icon: '📘',
    description: "Pulls events from a Facebook Page you own or manage.",
    pullable: true,
    setupUrl: 'https://developers.facebook.com/tools/explorer/',
    setupLabel: 'Open Graph API Explorer',
    note: "Heads up: Facebook's public events API was shut down in 2018. You can only pull events for a Page where you have admin access. Use Graph API Explorer (developers.facebook.com/tools/explorer) to generate a Page Access Token with the pages_read_engagement permission.",
    fields: [
      { name: 'page_id', label: 'Page ID', type: 'text', required: true },
      { name: 'access_token', label: 'Page Access Token', type: 'password', required: true },
    ],
  },
  {
    kind: 'rss',
    label: 'RSS / Atom feed',
    icon: '📰',
    description: "Pulls items from any RSS or Atom feed. Useful for local event blogs, Reddit subreddits (.rss), Substack event posts, etc.",
    pullable: true,
    fields: [
      { name: 'url', label: 'Feed URL', type: 'url', required: true, placeholder: 'https://…/feed.xml' },
    ],
  },
  {
    kind: 'webhook',
    label: 'Inbound webhook',
    icon: '🪝',
    description: "Catch-all for any source we can't reach directly. Point Zapier / Make / IFTTT / n8n / a script at the generated URL and POST events to it.",
    pullable: false,
    note: "On save, we'll generate a unique URL and token. POST { events: [{ external_id, title, starts_at?, location?, url?, description? }] } with header Authorization: Bearer <token>.",
    fields: [],
  },
];

export function findKind(kind: string): SyncKindDef | undefined {
  return SYNC_KINDS.find((k) => k.kind === kind);
}

// Pull only the registered field names out of a body and validate required ones.
// Returns { config } on success or { error } on failure.
export function buildConfigFromBody(
  kindDef: SyncKindDef,
  body: Record<string, any>,
): { config?: Record<string, string>; error?: string } {
  const config: Record<string, string> = {};
  for (const f of kindDef.fields) {
    const raw = body[f.name];
    const v = raw == null ? '' : String(raw).trim();
    if (f.required && !v) return { error: `${f.label} is required` };
    if (v) config[f.name] = v;
  }
  return { config };
}
