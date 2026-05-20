// Registry of organizer-page theme presets surfaced on /p/[slug].astro.
// Keep this file in sync with /src/components/organizer-themes/* when those
// renderers land. The keys here are the source of truth — the API and picker
// validate against ORGANIZER_PRESETS.

export type OrganizerPresetKey = 'brutalist' | 'zine' | 'cyber';

export interface OrganizerPreset {
  key: OrganizerPresetKey;
  label: string;
  description: string;
}

export const ORGANIZER_PRESETS: OrganizerPreset[] = [
  {
    key: 'brutalist',
    label: 'Brutalist',
    description: 'High-contrast, raw type, hard edges.',
  },
  {
    key: 'zine',
    label: 'Zine',
    description: 'Paper-cut collage energy, hand-set feel.',
  },
  {
    key: 'cyber',
    label: 'Cyber',
    description: 'Neon-on-dark, glitch accents, future-y.',
  },
];

const PRESET_KEYS = new Set<string>(ORGANIZER_PRESETS.map(p => p.key));

export function isOrganizerPresetKey(v: unknown): v is OrganizerPresetKey {
  return typeof v === 'string' && PRESET_KEYS.has(v);
}

export function resolvePreset(v: unknown): OrganizerPreset | null {
  if (typeof v !== 'string' || !v) return null;
  return ORGANIZER_PRESETS.find(p => p.key === v) ?? null;
}
