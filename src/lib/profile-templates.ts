// 16 personal-page templates. Each profile picks one via `profiles.template`.
// Per-template extra fields live in `profiles.template_data` as JSON.

export type ProfileTemplateKey =
  | 'host' | 'book_club' | 'game_group' | 'bible_study' | 'pottery'
  | 'run_club' | 'wellness' | 'music' | 'cause' | 'service_pro'
  | 'dogs' | 'climbing' | 'supper_club' | 'art' | 'language' | 'photography';

export interface ProfileTemplate {
  key: ProfileTemplateKey;
  label: string;
  emoji: string;
  accentColor: string;
}

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  { key: 'host',         label: 'Host / Default',         emoji: '🎉', accentColor: '#7C3AED' },
  { key: 'book_club',    label: 'Book club',              emoji: '📚', accentColor: '#C97A45' },
  { key: 'game_group',   label: 'Board game group',       emoji: '🎲', accentColor: '#FF3D7F' },
  { key: 'bible_study',  label: 'Bible study / faith',    emoji: '⛪', accentColor: '#C9A55D' },
  { key: 'pottery',      label: 'Pottery / maker',        emoji: '🏺', accentColor: '#C97A45' },
  { key: 'run_club',     label: 'Run club',               emoji: '🏃', accentColor: '#FFD93D' },
  { key: 'wellness',     label: 'Wellness / coach',       emoji: '🧘', accentColor: '#7BA17B' },
  { key: 'music',        label: 'Music / band',           emoji: '🎵', accentColor: '#E0335E' },
  { key: 'cause',        label: 'Cause / volunteer',      emoji: '🌱', accentColor: '#3D5E2E' },
  { key: 'service_pro',  label: 'Service pro / realtor',  emoji: '💼', accentColor: '#C9A55D' },
  { key: 'dogs',         label: 'Dog folks',              emoji: '🐕', accentColor: '#C97A45' },
  { key: 'climbing',     label: 'Climbing / outdoor',     emoji: '🧗', accentColor: '#FF7A1A' },
  { key: 'supper_club',  label: 'Supper club',            emoji: '🍳', accentColor: '#C9A55D' },
  { key: 'art',          label: 'Art / sketch group',     emoji: '🎨', accentColor: '#B85C38' },
  { key: 'language',     label: 'Language exchange',      emoji: '🌍', accentColor: '#FFD93D' },
  { key: 'photography',  label: 'Photography',            emoji: '📷', accentColor: '#FFD93D' },
];

export const PROFILE_TEMPLATE_KEYS: ReadonlySet<string> = new Set(PROFILE_TEMPLATES.map(t => t.key));

export function getTemplate(key: string | null | undefined): ProfileTemplate {
  if (!key) return PROFILE_TEMPLATES[0];
  const found = PROFILE_TEMPLATES.find(t => t.key === key);
  return found || PROFILE_TEMPLATES[0];
}

export function defaultTemplateData(key: string): Record<string, any> {
  switch (key) {
    case 'book_club':
      return {
        currently_reading: { title: 'The Overstory', author: 'Richard Powers', pages_read: 247, pages_total: 502 },
        next_meeting: "Fri Jun 7, 7pm at Lin's place · 5 of 8 spots",
        founded_year: '2024',
        cadence: 'Monthly',
      };
    case 'game_group':
      return {
        next_night: "Thursday · 7pm at Marcus's · 12 going · BYOB + snack",
        favorite_games: ['Wingspan', 'Codenames', 'Cascadia', 'Ark Nova'],
        player_count_note: 'Sweet spot 4–6. We split tables if more than 8 show up.',
      };
    case 'bible_study':
      return {
        verse: { text: 'Iron sharpens iron, and one man sharpens another.', reference: 'Proverbs 27:17 · ESV' },
        currently_in: 'The Book of Acts',
        cadence: 'Tuesdays 7–8:30pm',
        tradition: 'Non-denominational',
      };
    case 'pottery':
      return {
        gallery: [
          { emoji: '🏺', caption: 'chubby mugs' },
          { emoji: '🍶', caption: 'jar series' },
          { emoji: '🫖', caption: 'first teapot!' },
        ],
        classes: [
          { title: 'Intro to wheel — 4 weeks', when: 'Saturdays 10am · next start Jun 8', price_usd: 240 },
          { title: 'Open studio (members)', when: 'Thursdays 6–9pm · BYO clay', price_usd: 15 },
          { title: '1:1 lesson', when: 'by appointment · 90min', price_usd: 85 },
        ],
        studio_hours: 'Tues + Thurs evenings',
      };
    case 'run_club':
      return {
        pace: '9:30',
        members_count: 38,
        weekly_miles: 142,
        training_plan: { name: 'Bolder Boulder prep', week: 3, total_weeks: 8 },
        meet: "Saturday · 7am · Sloan's Lake N lot — 6 easy miles + coffee at Highland Tap after",
      };
    case 'wellness':
      return {
        philosophy_quote: 'The body benefits from movement; the mind benefits from stillness.',
        certifications: ['RYT-500', 'YIN CERTIFIED', 'TRAUMA-INFORMED'],
        weekly_schedule: [
          { day: 'Tuesday', time: 'In-home · 7pm' },
          { day: 'Wednesday', time: "Group at Sloan's · 6:30pm" },
          { day: 'Saturday', time: 'Sunrise outdoor · 8am' },
        ],
        pricing: '$25 drop-in · $200 ten-pack · first class free',
      };
    case 'music':
      return {
        tagline: 'porch concerts, dive bars, the occasional wedding',
        upcoming_gigs: [
          { date: '24 MAY', title: 'Porch concert · Berkeley', meta: 'Sat 6pm · BYOB · address day-of' },
          { date: '06 JUN', title: 'Larimer Lounge · opening slot', meta: 'Thu 9pm · $10 cover' },
        ],
        sound_link: 'Spotify · Bandcamp',
        looking_for: 'A bassist for summer shows',
      };
    case 'cause':
      return {
        mission: 'First Saturday of every month at the rec center, 9am, bags + gloves provided, pizza after.',
        impact_stats: [
          { n: 47, label: 'trash bags' },
          { n: 12, label: 'cleanups' },
          { n: 84, label: 'volunteers' },
        ],
        upcoming_days: [
          { when: 'Sat Jun 1', what: 'North side · 9am–noon' },
          { when: 'Sat Jul 6', what: 'South paths · 9am–noon' },
        ],
      };
    case 'service_pro':
      return {
        license_info: 'License #ER40036247',
        neighborhoods_served: ['Wash Park', 'Cherry Creek', 'Cap Hill', 'Congress Park', 'Hilltop'],
        testimonial: { text: 'Jimmy walked us through Wash Park for half a day before we even talked offers.', source: 'J. & M., bought May 2025' },
      };
    case 'dogs':
      return {
        pups: [
          { emoji: '🐶', name: 'Gravy', breed: 'pit mix · 8yr' },
          { emoji: '🦮', name: 'Olive', breed: 'husky · 3yr' },
          { emoji: '🐕‍🦺', name: 'Pickle', breed: 'frenchie · 5yr' },
          { emoji: '🐩', name: 'Mochi', breed: 'doodle · 2yr' },
        ],
        favorite_parks: ['Berkeley Lake', 'Highland Pet Park', 'Cheesman after hours'],
      };
    case 'climbing':
      return {
        lead_grade: '5.10b',
        boulder_grade: 'V4',
        project_note: 'project: V5',
        partner_call: 'Mid-grade, willing to belay 5.11 if you\'ll catch my 5.10',
      };
    case 'supper_club':
      return {
        next_dinner: {
          title: 'Italian Night',
          host: 'Marisol',
          date: 'Sat Jun 14, 7pm',
          seats: '6 of 8 seats · pasta-from-scratch lesson included',
        },
        meal_photos: [{ emoji: '🍝' }, { emoji: '🥘' }, { emoji: '🍷' }],
        dietary_note: 'Veg + omni mix · alert hosts to allergies',
        format_note: 'Sit-down, conversation-led',
      };
    case 'art':
      return {
        mediums: ['PEN & INK', 'WATERCOLOR', 'CHARCOAL', 'GOUACHE'],
        next_session: {
          title: 'Plein air · Confluence Park',
          location: 'meet at Whittier Café',
          date: 'Sat May 31, 9am',
        },
        sample_works: [{ emoji: '🎨' }, { emoji: '✏️' }, { emoji: '🖌' }, { emoji: '🖼' }],
      };
    case 'language':
      return {
        offered: ['🇺🇸 EN', '🇪🇸 ES', '🇫🇷 FR', '🇩🇪 DE'],
        wanted: ['🇯🇵 JA', '🇵🇹 PT', '🇰🇷 KO', '🇮🇹 IT'],
        meet_info: '📍 LoDo · Goosetown · ⏰ Thurs 6:30pm',
        level_range: 'A2–C1',
      };
    case 'photography':
      return {
        gear: 'Leica M6 · Mamiya 645 + Sony A7iii for clients',
        currently_shooting: { name: 'South Side Light', description: 'a series on porches in Wash Park' },
        photo_walk: { date: 'Sat Jun 1', location: 'Five Points morning light', meta: 'Meet at Welton & 26th · 7am · ~2 hours · 11 going' },
        style_tags: ['STREET', 'PORTRAIT', 'DOCUMENTARY', 'LANDSCAPE'],
        frames: [
          { emoji: '🎞', label: 'CHEESMAN · 35MM TRI-X' },
          { emoji: '🌆', label: 'RINO · DIGITAL' },
          { emoji: '🏔', label: 'MT EVANS · MED FMT' },
          { emoji: '🚶', label: 'FIVE PTS' },
          { emoji: '🍷', label: 'PORTRAIT' },
        ],
      };
    case 'host':
    default:
      return {};
  }
}

// Per-template field schemas — drive the form renderer in the editor.
export type FieldType = 'text' | 'textarea' | 'number' | 'url' | 'string-array' | 'object' | 'object-array';

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  fields?: TemplateField[]; // for object / object-array
  max?: number;             // for object-array
}

const SCHEMAS: Record<string, TemplateField[]> = {
  host: [],
  book_club: [
    { key: 'currently_reading', label: 'Currently reading', type: 'object', fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'pages_read', label: 'Pages read', type: 'number' },
      { key: 'pages_total', label: 'Pages total', type: 'number' },
    ]},
    { key: 'next_meeting', label: 'Next meeting', type: 'text', placeholder: "Fri Jun 7 at Lin's place" },
  ],
  game_group: [
    { key: 'next_night', label: 'Next game night', type: 'text', placeholder: "Thursday 7pm at Marcus's" },
    { key: 'favorite_games', label: 'Favorite games', type: 'string-array', help: 'comma-separated, like Wingspan, Codenames' },
    { key: 'player_count_note', label: 'Player-count note', type: 'textarea' },
  ],
  bible_study: [
    { key: 'verse', label: 'Verse', type: 'object', fields: [
      { key: 'text', label: 'Verse text', type: 'textarea' },
      { key: 'reference', label: 'Reference', type: 'text', placeholder: 'PROVERBS 27:17 · ESV' },
    ]},
    { key: 'currently_in', label: 'Currently in', type: 'text', placeholder: 'The Book of Acts' },
    { key: 'cadence', label: 'Cadence', type: 'text', placeholder: 'Tuesdays 7–8:30pm' },
    { key: 'tradition', label: 'Tradition', type: 'text', placeholder: 'Non-denominational' },
  ],
  pottery: [
    { key: 'gallery', label: 'Gallery', type: 'object-array', max: 6, fields: [
      { key: 'emoji', label: 'Emoji', type: 'text', placeholder: '🏺' },
      { key: 'caption', label: 'Caption', type: 'text', placeholder: 'chubby mugs' },
    ]},
    { key: 'classes', label: 'Classes', type: 'object-array', max: 6, fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'when', label: 'When', type: 'text' },
      { key: 'price_usd', label: 'Price', type: 'text', placeholder: '$240' },
    ]},
  ],
  run_club: [
    { key: 'pace', label: 'Pace', type: 'text', placeholder: '9:30 min/mi' },
    { key: 'weekly_miles', label: 'Weekly miles', type: 'text', placeholder: '142' },
    { key: 'training_plan', label: 'Training plan', type: 'object', fields: [
      { key: 'name', label: 'Plan name', type: 'text' },
      { key: 'week', label: 'Current week', type: 'number' },
      { key: 'total_weeks', label: 'Total weeks', type: 'number' },
    ]},
    { key: 'meet', label: 'Meet info', type: 'textarea', placeholder: "Saturday 7am at Sloan's Lake N lot" },
  ],
  wellness: [
    { key: 'philosophy_quote', label: 'Philosophy quote', type: 'textarea' },
    { key: 'certifications', label: 'Certifications', type: 'string-array', help: 'comma-separated, like RYT-500, Yin Certified' },
    { key: 'weekly_schedule', label: 'Weekly schedule', type: 'object-array', max: 7, fields: [
      { key: 'day', label: 'Day', type: 'text' },
      { key: 'time', label: 'Time', type: 'text' },
    ]},
    { key: 'pricing', label: 'Pricing', type: 'text', placeholder: '$25 drop-in · $200 ten-pack' },
  ],
  music: [
    { key: 'tagline', label: 'Tagline', type: 'text' },
    { key: 'upcoming_gigs', label: 'Upcoming gigs', type: 'object-array', max: 10, fields: [
      { key: 'date', label: 'Date', type: 'text', placeholder: 'May 24' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'meta', label: 'Meta', type: 'text' },
    ]},
    { key: 'sound_link', label: 'Sound link', type: 'url' },
    { key: 'looking_for', label: 'Looking for', type: 'text' },
  ],
  cause: [
    { key: 'mission', label: 'Mission', type: 'textarea' },
    { key: 'impact_stats', label: 'Impact stats', type: 'object-array', max: 6, fields: [
      { key: 'n', label: 'Number', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' },
    ]},
    { key: 'upcoming_days', label: 'Upcoming days', type: 'object-array', max: 8, fields: [
      { key: 'when', label: 'When', type: 'text' },
      { key: 'what', label: 'What', type: 'text' },
    ]},
  ],
  service_pro: [
    { key: 'license_info', label: 'License info', type: 'text', placeholder: 'License #ER40036247' },
    { key: 'neighborhoods_served', label: 'Neighborhoods served', type: 'string-array' },
    { key: 'testimonial', label: 'Testimonial', type: 'object', fields: [
      { key: 'text', label: 'Quote', type: 'textarea' },
      { key: 'source', label: 'Source', type: 'text', placeholder: '— J. & M.' },
    ]},
  ],
  dogs: [
    { key: 'pups', label: 'Pups', type: 'object-array', max: 8, fields: [
      { key: 'emoji', label: 'Emoji', type: 'text' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'breed', label: 'Breed', type: 'text' },
    ]},
    { key: 'favorite_parks', label: 'Favorite parks', type: 'string-array' },
  ],
  climbing: [
    { key: 'lead_grade', label: 'Lead grade', type: 'text' },
    { key: 'boulder_grade', label: 'Boulder grade', type: 'text' },
    { key: 'project_note', label: 'Project note', type: 'textarea' },
    { key: 'partner_call', label: 'Partner call', type: 'textarea' },
  ],
  supper_club: [
    { key: 'next_dinner', label: 'Next dinner', type: 'object', fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'host', label: 'Host', type: 'text' },
      { key: 'date', label: 'Date', type: 'text' },
      { key: 'seats', label: 'Seats', type: 'text' },
    ]},
    { key: 'meal_photos', label: 'Meal photos', type: 'string-array', help: 'emoji photos, like 🍝, 🥘, 🍷' },
    { key: 'dietary_note', label: 'Dietary note', type: 'text' },
    { key: 'format_note', label: 'Format note', type: 'text' },
  ],
  art: [
    { key: 'mediums', label: 'Mediums', type: 'string-array' },
    { key: 'next_session', label: 'Next session', type: 'object', fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'date', label: 'Date', type: 'text' },
    ]},
    { key: 'sample_works', label: 'Sample works', type: 'string-array', help: 'emoji samples' },
  ],
  language: [
    { key: 'offered', label: 'Languages offered', type: 'string-array', help: 'language codes like EN, ES, FR' },
    { key: 'wanted', label: 'Languages wanted', type: 'string-array' },
    { key: 'meet_info', label: 'Meet info', type: 'textarea', placeholder: 'Thursdays 6:30pm · Goosetown in LoDo' },
    { key: 'level_range', label: 'Level range', type: 'text', placeholder: 'A2–C1' },
  ],
  photography: [
    { key: 'gear', label: 'Gear', type: 'text', placeholder: 'Leica M6 · Mamiya 645' },
    { key: 'currently_shooting', label: 'Currently shooting', type: 'textarea' },
    { key: 'photo_walk_when', label: 'Next photo walk', type: 'text' },
    { key: 'style_tags', label: 'Style tags', type: 'string-array' },
    { key: 'frames', label: 'Frames', type: 'object-array', max: 5, fields: [
      { key: 'emoji', label: 'Emoji', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' },
    ]},
  ],
};

export function templateSchema(key: string): TemplateField[] {
  return SCHEMAS[key] || [];
}

// Parse template_data JSON safely. Falls back to {}.
export function parseTemplateData(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch {
    return {};
  }
}
