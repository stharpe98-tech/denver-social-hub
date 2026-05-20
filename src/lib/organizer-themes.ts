// Organizer page "design presets" — independent of the content-type
// `template` system in profile-templates.ts. A preset controls the entire
// visual identity (layout, type stack, color world, micro-interactions)
// of an organizer's public page at /p/<slug>. The intent is editorial
// distinctiveness: each preset must look hand-designed and own the
// viewport, not look like the Denver Social parent platform.

export type OrganizerPresetKey = 'brutalist' | 'zine' | 'cyber';

export interface OrganizerPreset {
  key: OrganizerPresetKey;
  label: string;
  blurb: string;
  // Font links embedded into <head> by the page route. Each must include
  // `display=swap` per project rules.
  fontHref: string;
  // Default accent if the profile didn't pick one; presets pin different
  // chromas (cool neon vs warm marigold) so the wrong default would
  // undermine the preset's mood.
  defaultAccent: string;
}

export const ORGANIZER_PRESETS: Record<OrganizerPresetKey, OrganizerPreset> = {
  brutalist: {
    key: 'brutalist',
    label: 'Brutalist',
    blurb: 'Editorial poster — stark canvas, oversized serif headline, hairline rules.',
    fontHref:
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,800;9..144,900&family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap',
    defaultAccent: '#E11D48',
  },
  zine: {
    key: 'zine',
    label: 'Zine',
    blurb: 'Cut-paper cream layout — warm tints, layered paper cards, hand-set feel.',
    fontHref:
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap',
    defaultAccent: '#9A6E3A',
  },
  cyber: {
    key: 'cyber',
    label: 'Cyber',
    blurb: 'Terminal-grid black — neon hairlines, monospace headers, scanline rest state.',
    fontHref:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@500;700;800&display=swap',
    defaultAccent: '#22D3EE',
  },
};

export const ORGANIZER_PRESET_KEYS: ReadonlySet<string> = new Set(
  Object.keys(ORGANIZER_PRESETS),
);

export function resolvePreset(raw: unknown): OrganizerPreset {
  const k = typeof raw === 'string' ? raw.toLowerCase().trim() : '';
  if (ORGANIZER_PRESET_KEYS.has(k)) {
    return ORGANIZER_PRESETS[k as OrganizerPresetKey];
  }
  return ORGANIZER_PRESETS.brutalist;
}

// Shared shape every theme component consumes. Keeps the presentation
// layer fully decoupled from the DB query — the route hands down a plain
// object, themes don't touch D1 or cookies.
export interface OrganizerThemeProps {
  profile: {
    slug: string;
    display_name: string;
    headline: string | null;
    bio: string | null;
    photo_emoji: string | null;
    accent_color: string | null;
    neighborhood: string | null;
    cover_photo_url: string | null;
    avatar_photo_url: string | null;
  };
  events: Array<{
    id: number | string;
    title: string;
    month: string;
    day: string;
    location: string | null;
    past: boolean;
  }>;
  offers: Array<{ icon?: string; label: string }>;
  links: Array<{ icon?: string; label: string; url: string }>;
  accent: string;
}
