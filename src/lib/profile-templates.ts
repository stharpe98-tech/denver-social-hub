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
    { key: 'currently_reading', label: 'What you\'re reading right now', type: 'object', help: 'The book your club is on this month', fields: [
      { key: 'title', label: 'Book title', type: 'text', placeholder: 'The Overstory' },
      { key: 'author', label: 'Author', type: 'text', placeholder: 'Richard Powers' },
      { key: 'pages_read', label: 'Pages read so far', type: 'number', placeholder: '247' },
      { key: 'pages_total', label: 'Total pages', type: 'number', placeholder: '502' },
    ]},
    { key: 'next_meeting', label: 'When + where you meet next', type: 'text', placeholder: "Fri Jun 7, 7pm at Lin's place" },
  ],
  game_group: [
    { key: 'next_night', label: 'Next game night', type: 'text', placeholder: "Thursday 7pm at Marcus's place" },
    { key: 'favorite_games', label: 'Games the group loves', type: 'string-array', help: 'Comma-separated. Example: Wingspan, Codenames, Cascadia' },
    { key: 'player_count_note', label: 'How many people show up', type: 'textarea', placeholder: 'Sweet spot is 4–6. We split tables if more than 8.' },
  ],
  bible_study: [
    { key: 'verse', label: 'A favorite verse', type: 'object', help: 'Optional — a scripture that captures the group\'s spirit', fields: [
      { key: 'text', label: 'The verse itself', type: 'textarea', placeholder: '"Iron sharpens iron, and one man sharpens another."' },
      { key: 'reference', label: 'Where it\'s from', type: 'text', placeholder: 'PROVERBS 27:17 · ESV' },
    ]},
    { key: 'currently_in', label: 'Book of the Bible you\'re studying', type: 'text', placeholder: 'The Book of Acts' },
    { key: 'cadence', label: 'When you meet', type: 'text', placeholder: 'Tuesdays 7–8:30pm' },
    { key: 'tradition', label: 'Tradition / denomination', type: 'text', placeholder: 'Non-denominational' },
  ],
  pottery: [
    { key: 'gallery', label: 'Recent work', type: 'object-array', max: 6, help: 'Add up to 6 pieces — emoji + a short caption each', fields: [
      { key: 'emoji', label: 'Piece emoji', type: 'text', placeholder: '🏺' },
      { key: 'caption', label: 'What it is', type: 'text', placeholder: 'chubby mugs' },
    ]},
    { key: 'classes', label: 'Classes you teach', type: 'object-array', max: 6, help: 'Each row is one class type', fields: [
      { key: 'title', label: 'Class name', type: 'text', placeholder: 'Intro to wheel — 4 weeks' },
      { key: 'when', label: 'When it runs', type: 'text', placeholder: 'Saturdays 10am · next start Jun 8' },
      { key: 'price_usd', label: 'Price', type: 'text', placeholder: '$240' },
    ]},
  ],
  run_club: [
    { key: 'pace', label: 'Typical pace', type: 'text', placeholder: '9:30 min/mi' },
    { key: 'weekly_miles', label: 'Group miles per week', type: 'text', placeholder: '142' },
    { key: 'training_plan', label: 'Current training plan', type: 'object', help: 'Optional — if the group is prepping for a race', fields: [
      { key: 'name', label: 'Plan name', type: 'text', placeholder: 'Bolder Boulder prep' },
      { key: 'week', label: 'Current week', type: 'number', placeholder: '3' },
      { key: 'total_weeks', label: 'Total weeks', type: 'number', placeholder: '8' },
    ]},
    { key: 'meet', label: 'When + where you meet', type: 'textarea', placeholder: "Saturday 7am at Sloan's Lake north lot. 6 easy miles, coffee after." },
  ],
  wellness: [
    { key: 'philosophy_quote', label: 'Your teaching philosophy (one or two lines)', type: 'textarea', placeholder: 'The body benefits from movement; the mind benefits from stillness.' },
    { key: 'certifications', label: 'Certifications', type: 'string-array', help: 'Comma-separated. Example: RYT-500, Yin Certified, Trauma-informed' },
    { key: 'weekly_schedule', label: 'Class schedule', type: 'object-array', max: 7, help: 'One row per day you teach', fields: [
      { key: 'day', label: 'Day', type: 'text', placeholder: 'Tuesday' },
      { key: 'time', label: 'Time + where', type: 'text', placeholder: 'In-home, 7pm' },
    ]},
    { key: 'pricing', label: 'Pricing', type: 'text', placeholder: '$25 drop-in · $200 ten-pack · first class free' },
  ],
  music: [
    { key: 'tagline', label: 'One-line description', type: 'text', placeholder: 'Folk duo · porch concerts + dive bars' },
    { key: 'upcoming_gigs', label: 'Upcoming gigs', type: 'object-array', max: 10, help: 'One row per show', fields: [
      { key: 'date', label: 'Date', type: 'text', placeholder: 'May 24' },
      { key: 'title', label: 'Venue / event', type: 'text', placeholder: 'Porch concert · Berkeley' },
      { key: 'meta', label: 'Time + details', type: 'text', placeholder: 'Sat 6pm · BYOB · address day-of' },
    ]},
    { key: 'sound_link', label: 'Link to your music', type: 'url', placeholder: 'https://open.spotify.com/...' },
    { key: 'looking_for', label: 'Looking for (optional)', type: 'text', placeholder: 'A bassist for summer shows' },
  ],
  cause: [
    { key: 'mission', label: 'Your mission', type: 'textarea', placeholder: 'We meet the first Saturday of every month at Sloan\'s Lake at 9am to pick up trash. Bags and gloves provided. Pizza after.' },
    { key: 'impact_stats', label: 'Impact so far', type: 'object-array', max: 6, help: 'Numbers worth bragging about — one per row', fields: [
      { key: 'n', label: 'Number', type: 'text', placeholder: '47' },
      { key: 'label', label: 'What it\'s counting', type: 'text', placeholder: 'trash bags' },
    ]},
    { key: 'upcoming_days', label: 'Upcoming volunteer days', type: 'object-array', max: 8, fields: [
      { key: 'when', label: 'Date', type: 'text', placeholder: 'Sat Jun 1' },
      { key: 'what', label: 'Where + what', type: 'text', placeholder: 'North side · 9am–noon' },
    ]},
  ],
  service_pro: [
    { key: 'license_info', label: 'License / credential (optional)', type: 'text', placeholder: 'License #ER40036247' },
    { key: 'neighborhoods_served', label: 'Neighborhoods you cover', type: 'string-array', help: 'Comma-separated. Example: Wash Park, Cherry Creek, Cap Hill' },
    { key: 'testimonial', label: 'A favorite testimonial (optional)', type: 'object', help: 'One review that captures what you\'re about', fields: [
      { key: 'text', label: 'The quote', type: 'textarea', placeholder: 'Jimmy walked us through Wash Park for half a day before we even talked offers.' },
      { key: 'source', label: 'Who said it', type: 'text', placeholder: '— J. & M., bought May 2025' },
    ]},
  ],
  dogs: [
    { key: 'pups', label: 'The regular dogs', type: 'object-array', max: 8, help: 'Add the pups who show up most often', fields: [
      { key: 'emoji', label: 'Dog emoji', type: 'text', placeholder: '🐶' },
      { key: 'name', label: 'Pup\'s name', type: 'text', placeholder: 'Gravy' },
      { key: 'breed', label: 'Breed + age', type: 'text', placeholder: 'pit mix · 8yr' },
    ]},
    { key: 'favorite_parks', label: 'Favorite parks', type: 'string-array', help: 'Comma-separated. Example: Berkeley Lake, Highland Pet Park, Cheesman' },
  ],
  climbing: [
    { key: 'lead_grade', label: 'Lead climbing grade', type: 'text', placeholder: '5.10b' },
    { key: 'boulder_grade', label: 'Bouldering grade', type: 'text', placeholder: 'V4' },
    { key: 'project_note', label: 'Current project / goal', type: 'textarea', placeholder: 'Working a 5.10d at Clear Creek. Trying to send my first multi-pitch this summer.' },
    { key: 'partner_call', label: 'Partners wanted?', type: 'textarea', placeholder: 'Looking for Saturday outdoor partners. Mid-grade. Will catch your 5.11 if you\'ll catch my 5.10.' },
  ],
  supper_club: [
    { key: 'next_dinner', label: 'Next dinner', type: 'object', help: 'When the next gathering is and who\'s hosting', fields: [
      { key: 'title', label: 'Theme / name', type: 'text', placeholder: 'Italian Night' },
      { key: 'host', label: 'Who\'s hosting', type: 'text', placeholder: 'Marisol' },
      { key: 'date', label: 'When', type: 'text', placeholder: 'Sat Jun 14, 7pm' },
      { key: 'seats', label: 'Spots open', type: 'text', placeholder: '6 of 8 seats' },
    ]},
    { key: 'meal_photos', label: 'Past meals (emoji)', type: 'string-array', help: 'Comma-separated emoji. Example: 🍝, 🥘, 🍷' },
    { key: 'dietary_note', label: 'Dietary stance', type: 'text', placeholder: 'Veg + omni mix. Alert hosts to allergies.' },
    { key: 'format_note', label: 'How dinners run', type: 'text', placeholder: 'Sit-down, conversation-led, BYOB' },
  ],
  art: [
    { key: 'mediums', label: 'Mediums you work in', type: 'string-array', help: 'Comma-separated. Example: Pen & ink, Watercolor, Charcoal, Gouache' },
    { key: 'next_session', label: 'Next sketch session', type: 'object', help: 'Optional — when the group meets next', fields: [
      { key: 'title', label: 'What kind of session', type: 'text', placeholder: 'Plein air · Confluence Park' },
      { key: 'location', label: 'Meeting spot', type: 'text', placeholder: 'Meet at Whittier Café' },
      { key: 'date', label: 'When', type: 'text', placeholder: 'Sat May 31, 9am' },
    ]},
    { key: 'sample_works', label: 'Sample work emojis', type: 'string-array', help: 'Comma-separated emoji that hint at your style. Example: 🎨, ✏️, 🖌, 🖼' },
  ],
  language: [
    { key: 'offered', label: 'Languages you can speak / teach', type: 'string-array', help: 'Short codes, comma-separated. Example: EN, ES, FR' },
    { key: 'wanted', label: 'Languages you want to practice', type: 'string-array', help: 'Short codes, comma-separated. Example: JA, PT, KO' },
    { key: 'meet_info', label: 'When + where you meet', type: 'textarea', placeholder: 'Thursdays 6:30pm at Goosetown in LoDo' },
    { key: 'level_range', label: 'Skill range welcome', type: 'text', placeholder: 'A2–C1' },
  ],
  photography: [
    { key: 'gear', label: 'Your gear', type: 'text', placeholder: 'Leica M6 · Mamiya 645 · Sony A7iii for clients' },
    { key: 'currently_shooting', label: 'Current project', type: 'textarea', placeholder: '"South Side Light" — a series on porches in Wash Park.' },
    { key: 'photo_walk_when', label: 'Next photo walk', type: 'text', placeholder: 'Sat Jun 1 · Five Points morning light · 7am' },
    { key: 'style_tags', label: 'Style tags', type: 'string-array', help: 'Comma-separated. Example: Street, Portrait, Documentary, Landscape' },
    { key: 'frames', label: 'Sample frames', type: 'object-array', max: 5, help: 'Up to 5 emoji + caption pairs that hint at your portfolio', fields: [
      { key: 'emoji', label: 'Emoji', type: 'text', placeholder: '🎞' },
      { key: 'label', label: 'Caption (place + style)', type: 'text', placeholder: 'CHEESMAN · 35MM TRI-X' },
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
