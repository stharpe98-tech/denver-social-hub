// Canonical Denver-metro neighborhood list for the flyer-board frame.
// Used by the hero picker, the /community resolver, and the post composer.

export type Neighborhood = {
  slug: string;
  label: string;
  city: string;        // grouping: "Denver", "Aurora", "Littleton", etc.
  area: string;        // sub-grouping within Denver only
  lat: number;
  lng: number;
  neighbors?: string[];
};

export const NEIGHBORHOODS: Neighborhood[] = [
  // ═══ Denver — Downtown ═══
  { slug: 'downtown',      label: 'Downtown / CBD', city: 'Denver', area: 'Downtown',     lat: 39.7458, lng: -104.9907, neighbors: ['lodo','golden-triangle','capitol-hill','five-points'] },
  { slug: 'lodo',          label: 'LoDo',           city: 'Denver', area: 'Downtown',     lat: 39.7530, lng: -104.9990, neighbors: ['rino','lohi','capitol-hill','five-points','downtown'] },
  { slug: 'rino',          label: 'RiNo',           city: 'Denver', area: 'Downtown',     lat: 39.7707, lng: -104.9819, neighbors: ['five-points','lodo','lohi','capitol-hill','cherry-creek'] },
  { slug: 'lohi',          label: 'LoHi',           city: 'Denver', area: 'Downtown',     lat: 39.7587, lng: -105.0085, neighbors: ['lodo','highlands','rino','speer'] },
  { slug: 'golden-triangle', label: 'Golden Triangle', city: 'Denver', area: 'Downtown',  lat: 39.7345, lng: -104.9893, neighbors: ['downtown','capitol-hill','speer','baker','lincoln-park'] },
  { slug: 'auraria',       label: 'Auraria',        city: 'Denver', area: 'Downtown',     lat: 39.7456, lng: -105.0058, neighbors: ['lodo','downtown','lincoln-park','sun-valley'] },
  { slug: 'lincoln-park',  label: 'Lincoln Park / La Alma', city: 'Denver', area: 'Downtown', lat: 39.7298, lng: -105.0034, neighbors: ['auraria','baker','sun-valley','golden-triangle'] },

  // ═══ Denver — Central ═══
  { slug: 'five-points',   label: 'Five Points',    city: 'Denver', area: 'Central',      lat: 39.7593, lng: -104.9794, neighbors: ['rino','capitol-hill','city-park','lodo','curtis-park','whittier'] },
  { slug: 'capitol-hill',  label: 'Capitol Hill',   city: 'Denver', area: 'Central',      lat: 39.7355, lng: -104.9787, neighbors: ['cherry-creek','speer','five-points','congress-park','rino','uptown','cheesman-park'] },
  { slug: 'speer',         label: 'Speer',          city: 'Denver', area: 'Central',      lat: 39.7235, lng: -104.9851, neighbors: ['capitol-hill','baker','lohi','wash-park','golden-triangle'] },
  { slug: 'uptown',        label: 'Uptown',         city: 'Denver', area: 'Central',      lat: 39.7459, lng: -104.9709, neighbors: ['capitol-hill','five-points','cheesman-park','city-park'] },
  { slug: 'cheesman-park', label: 'Cheesman Park',  city: 'Denver', area: 'Central',      lat: 39.7351, lng: -104.9683, neighbors: ['capitol-hill','congress-park','uptown','country-club'] },
  { slug: 'country-club',  label: 'Country Club',   city: 'Denver', area: 'Central',      lat: 39.7282, lng: -104.9647, neighbors: ['cheesman-park','cherry-creek','wash-park','congress-park'] },
  { slug: 'curtis-park',   label: 'Curtis Park',    city: 'Denver', area: 'Central',      lat: 39.7591, lng: -104.9851, neighbors: ['five-points','rino','whittier','cole'] },
  { slug: 'whittier',      label: 'Whittier',       city: 'Denver', area: 'Central',      lat: 39.7556, lng: -104.9636, neighbors: ['five-points','city-park','cole','curtis-park'] },
  { slug: 'cole',          label: 'Cole',           city: 'Denver', area: 'Central',      lat: 39.7637, lng: -104.9678, neighbors: ['curtis-park','whittier','clayton','five-points'] },
  { slug: 'clayton',       label: 'Clayton',        city: 'Denver', area: 'Central',      lat: 39.7711, lng: -104.9646, neighbors: ['cole','skyland','city-park','elyria-swansea'] },

  // ═══ Denver — Northwest ═══
  { slug: 'highlands',     label: 'Highland (West Highland)', city: 'Denver', area: 'Northwest', lat: 39.7647, lng: -105.0178, neighbors: ['lohi','sloans-lake','berkeley','sunnyside'] },
  { slug: 'berkeley',      label: 'Berkeley',       city: 'Denver', area: 'Northwest',    lat: 39.7795, lng: -105.0420, neighbors: ['highlands','sloans-lake','regis'] },
  { slug: 'sloans-lake',   label: "Sloan's Lake",   city: 'Denver', area: 'Northwest',    lat: 39.7497, lng: -105.0494, neighbors: ['highlands','berkeley','edgewater','west-colfax'] },
  { slug: 'sunnyside',     label: 'Sunnyside',      city: 'Denver', area: 'Northwest',    lat: 39.7775, lng: -105.0192, neighbors: ['highlands','berkeley','chaffee-park','lohi'] },
  { slug: 'chaffee-park',  label: 'Chaffee Park',   city: 'Denver', area: 'Northwest',    lat: 39.7902, lng: -105.0210, neighbors: ['sunnyside','regis','globeville'] },
  { slug: 'regis',         label: 'Regis',          city: 'Denver', area: 'Northwest',    lat: 39.7894, lng: -105.0331, neighbors: ['berkeley','chaffee-park'] },
  { slug: 'west-colfax',   label: 'West Colfax',    city: 'Denver', area: 'Northwest',    lat: 39.7397, lng: -105.0394, neighbors: ['sloans-lake','sun-valley','villa-park','lakewood-eiber'] },
  { slug: 'villa-park',    label: 'Villa Park',     city: 'Denver', area: 'Northwest',    lat: 39.7331, lng: -105.0428, neighbors: ['west-colfax','sun-valley','barnum'] },

  // ═══ Denver — East ═══
  { slug: 'city-park',     label: 'City Park',      city: 'Denver', area: 'East',         lat: 39.7475, lng: -104.9476, neighbors: ['five-points','congress-park','park-hill','whittier','uptown'] },
  { slug: 'city-park-west',label: 'City Park West', city: 'Denver', area: 'East',         lat: 39.7432, lng: -104.9613, neighbors: ['city-park','uptown','five-points'] },
  { slug: 'congress-park', label: 'Congress Park',  city: 'Denver', area: 'East',         lat: 39.7349, lng: -104.9554, neighbors: ['cherry-creek','capitol-hill','city-park','hilltop','cheesman-park'] },
  { slug: 'park-hill',     label: 'Park Hill',      city: 'Denver', area: 'East',         lat: 39.7497, lng: -104.9214, neighbors: ['city-park','stapleton','lowry','south-park-hill','north-park-hill'] },
  { slug: 'north-park-hill', label: 'North Park Hill', city: 'Denver', area: 'East',      lat: 39.7644, lng: -104.9214, neighbors: ['park-hill','skyland','stapleton'] },
  { slug: 'south-park-hill', label: 'South Park Hill', city: 'Denver', area: 'East',      lat: 39.7335, lng: -104.9214, neighbors: ['park-hill','hilltop','montclair'] },
  { slug: 'skyland',       label: 'Skyland',        city: 'Denver', area: 'East',         lat: 39.7669, lng: -104.9499, neighbors: ['city-park','clayton','north-park-hill'] },
  { slug: 'cherry-creek',  label: 'Cherry Creek',   city: 'Denver', area: 'East',         lat: 39.7180, lng: -104.9540, neighbors: ['capitol-hill','wash-park','hilltop','congress-park','rino','country-club'] },
  { slug: 'hilltop',       label: 'Hilltop',        city: 'Denver', area: 'East',         lat: 39.7176, lng: -104.9335, neighbors: ['cherry-creek','congress-park','lowry','virginia-vale','montclair'] },
  { slug: 'montclair',     label: 'Montclair',      city: 'Denver', area: 'East',         lat: 39.7350, lng: -104.9214, neighbors: ['hilltop','south-park-hill','lowry','east-colfax'] },
  { slug: 'east-colfax',   label: 'East Colfax',    city: 'Denver', area: 'East',         lat: 39.7402, lng: -104.8939, neighbors: ['montclair','lowry','aurora-original'] },

  // ═══ Denver — North ═══
  { slug: 'globeville',    label: 'Globeville',     city: 'Denver', area: 'North',        lat: 39.7838, lng: -104.9869, neighbors: ['elyria-swansea','chaffee-park','sunnyside'] },
  { slug: 'elyria-swansea',label: 'Elyria-Swansea', city: 'Denver', area: 'North',        lat: 39.7855, lng: -104.9590, neighbors: ['globeville','clayton','commerce-city'] },

  // ═══ Denver — Northeast ═══
  { slug: 'stapleton',     label: 'Central Park',   city: 'Denver', area: 'Northeast',    lat: 39.7656, lng: -104.8929, neighbors: ['park-hill','lowry','green-valley','north-park-hill'] },
  { slug: 'lowry',         label: 'Lowry',          city: 'Denver', area: 'Northeast',    lat: 39.7172, lng: -104.8970, neighbors: ['park-hill','hilltop','stapleton','virginia-vale','montclair','east-colfax'] },
  { slug: 'green-valley',  label: 'Green Valley Ranch', city: 'Denver', area: 'Northeast', lat: 39.7913, lng: -104.7654, neighbors: ['stapleton','dia','montbello'] },
  { slug: 'montbello',     label: 'Montbello',      city: 'Denver', area: 'Northeast',    lat: 39.7841, lng: -104.8336, neighbors: ['stapleton','green-valley'] },
  { slug: 'dia',           label: 'DIA / Gateway',  city: 'Denver', area: 'Northeast',    lat: 39.8617, lng: -104.6731, neighbors: ['green-valley'] },

  // ═══ Denver — South ═══
  { slug: 'wash-park',     label: 'Wash Park',      city: 'Denver', area: 'South',        lat: 39.7008, lng: -104.9701, neighbors: ['baker','platt-park','speer','cherry-creek','country-club','wash-park-west'] },
  { slug: 'wash-park-west',label: 'West Wash Park', city: 'Denver', area: 'South',        lat: 39.7034, lng: -104.9836, neighbors: ['wash-park','baker','platt-park'] },
  { slug: 'baker',         label: 'Baker',          city: 'Denver', area: 'South',        lat: 39.7203, lng: -104.9923, neighbors: ['wash-park','speer','platt-park','wash-park-west','lincoln-park'] },
  { slug: 'platt-park',    label: 'Platt Park',     city: 'Denver', area: 'South',        lat: 39.6810, lng: -104.9836, neighbors: ['wash-park','baker','university','overland','rosedale'] },
  { slug: 'overland',      label: 'Overland',       city: 'Denver', area: 'South',        lat: 39.6735, lng: -105.0000, neighbors: ['platt-park','rosedale','ruby-hill'] },
  { slug: 'rosedale',      label: 'Rosedale',       city: 'Denver', area: 'South',        lat: 39.6691, lng: -104.9836, neighbors: ['platt-park','overland','university'] },
  { slug: 'university',    label: 'University',     city: 'Denver', area: 'South',        lat: 39.6776, lng: -104.9621, neighbors: ['platt-park','wellshire','virginia-vale','rosedale','university-park'] },
  { slug: 'university-park',label: 'University Park',city: 'Denver', area: 'South',        lat: 39.6712, lng: -104.9555, neighbors: ['university','wellshire','virginia-vale'] },
  { slug: 'wellshire',     label: 'Wellshire',      city: 'Denver', area: 'South',        lat: 39.6650, lng: -104.9595, neighbors: ['university','platt-park','hampden'] },
  { slug: 'hampden',       label: 'Hampden',        city: 'Denver', area: 'South',        lat: 39.6541, lng: -104.9358, neighbors: ['wellshire','virginia-vale','university-park'] },
  { slug: 'virginia-vale', label: 'Virginia Vale',  city: 'Denver', area: 'Southeast',    lat: 39.6929, lng: -104.9163, neighbors: ['lowry','hilltop','university','hampden','indian-creek'] },
  { slug: 'indian-creek',  label: 'Indian Creek',   city: 'Denver', area: 'Southeast',    lat: 39.6759, lng: -104.9098, neighbors: ['virginia-vale','hampden'] },

  // ═══ Denver — Southwest ═══
  { slug: 'sun-valley',    label: 'Sun Valley',     city: 'Denver', area: 'Southwest',    lat: 39.7345, lng: -105.0167, neighbors: ['auraria','lincoln-park','villa-park','west-colfax'] },
  { slug: 'valverde',      label: 'Valverde',       city: 'Denver', area: 'Southwest',    lat: 39.7228, lng: -105.0136, neighbors: ['sun-valley','barnum','athmar-park','lincoln-park'] },
  { slug: 'barnum',        label: 'Barnum',         city: 'Denver', area: 'Southwest',    lat: 39.7176, lng: -105.0411, neighbors: ['villa-park','valverde','westwood','mar-lee'] },
  { slug: 'westwood',      label: 'Westwood',       city: 'Denver', area: 'Southwest',    lat: 39.6918, lng: -105.0411, neighbors: ['barnum','mar-lee','athmar-park','harvey-park'] },
  { slug: 'mar-lee',       label: 'Mar Lee',        city: 'Denver', area: 'Southwest',    lat: 39.6837, lng: -105.0411, neighbors: ['westwood','harvey-park','barnum'] },
  { slug: 'athmar-park',   label: 'Athmar Park',    city: 'Denver', area: 'Southwest',    lat: 39.6940, lng: -105.0167, neighbors: ['valverde','westwood','ruby-hill'] },
  { slug: 'ruby-hill',     label: 'Ruby Hill',      city: 'Denver', area: 'Southwest',    lat: 39.6730, lng: -105.0167, neighbors: ['athmar-park','overland','college-view'] },
  { slug: 'harvey-park',   label: 'Harvey Park',    city: 'Denver', area: 'Southwest',    lat: 39.6577, lng: -105.0500, neighbors: ['mar-lee','westwood','marston','harvey-park-south'] },
  { slug: 'harvey-park-south', label: 'Harvey Park South', city: 'Denver', area: 'Southwest', lat: 39.6450, lng: -105.0500, neighbors: ['harvey-park','marston'] },
  { slug: 'marston',       label: 'Marston',        city: 'Denver', area: 'Southwest',    lat: 39.6275, lng: -105.0686, neighbors: ['harvey-park','harvey-park-south','bear-valley'] },
  { slug: 'bear-valley',   label: 'Bear Valley',    city: 'Denver', area: 'Southwest',    lat: 39.6438, lng: -105.0728, neighbors: ['marston','harvey-park'] },
  { slug: 'college-view',  label: 'College View',   city: 'Denver', area: 'South',        lat: 39.6603, lng: -105.0000, neighbors: ['ruby-hill','overland','fort-logan'] },
  { slug: 'fort-logan',    label: 'Fort Logan',     city: 'Denver', area: 'Southwest',    lat: 39.6494, lng: -105.0339, neighbors: ['college-view','marston','bear-valley'] },

  // ═══ Aurora ═══
  { slug: 'aurora-original',    label: 'Original Aurora',  city: 'Aurora',    area: '',   lat: 39.7294, lng: -104.8316 },
  { slug: 'aurora-highlands',   label: 'Aurora Highlands', city: 'Aurora',    area: '',   lat: 39.6694, lng: -104.8316 },
  { slug: 'aurora-tollgate',    label: 'Tollgate Crossing',city: 'Aurora',    area: '',   lat: 39.6433, lng: -104.7458 },
  { slug: 'aurora-saddle-rock', label: 'Saddle Rock',      city: 'Aurora',    area: '',   lat: 39.6028, lng: -104.7700 },
  { slug: 'aurora-centretech',  label: 'Centretech',       city: 'Aurora',    area: '',   lat: 39.7102, lng: -104.8064 },
  { slug: 'aurora-mission-viejo', label: 'Mission Viejo',  city: 'Aurora',    area: '',   lat: 39.6515, lng: -104.7918 },

  // ═══ Lakewood ═══
  { slug: 'lakewood-belmar',       label: 'Belmar',         city: 'Lakewood', area: '',   lat: 39.7099, lng: -105.0817 },
  { slug: 'lakewood-green-mtn',    label: 'Green Mountain', city: 'Lakewood', area: '',   lat: 39.6892, lng: -105.1322 },
  { slug: 'lakewood-bear-creek',   label: 'Bear Creek',     city: 'Lakewood', area: '',   lat: 39.6512, lng: -105.0833 },
  { slug: 'lakewood-solterra',     label: 'Solterra',       city: 'Lakewood', area: '',   lat: 39.6878, lng: -105.1577 },
  { slug: 'lakewood-eiber',        label: 'Eiber',          city: 'Lakewood', area: '',   lat: 39.7330, lng: -105.0769 },

  // ═══ Wheat Ridge ═══
  { slug: 'wheat-ridge',           label: 'Wheat Ridge',    city: 'Wheat Ridge', area: '',lat: 39.7661, lng: -105.0772 },
  { slug: 'applewood',             label: 'Applewood',      city: 'Wheat Ridge', area: '',lat: 39.7522, lng: -105.1364 },

  // ═══ Edgewater ═══
  { slug: 'edgewater',             label: 'Edgewater',      city: 'Edgewater', area: '',  lat: 39.7508, lng: -105.0644 },

  // ═══ Mountain View ═══
  { slug: 'mountain-view',         label: 'Mountain View',  city: 'Mountain View', area: '', lat: 39.7727, lng: -105.0589 },

  // ═══ Glendale ═══
  { slug: 'glendale',              label: 'Glendale',       city: 'Glendale', area: '',  lat: 39.7058, lng: -104.9339 },

  // ═══ Sheridan ═══
  { slug: 'sheridan',              label: 'Sheridan',       city: 'Sheridan', area: '',  lat: 39.6469, lng: -105.0286 },

  // ═══ Arvada ═══
  { slug: 'arvada-olde-town',      label: 'Olde Town Arvada', city: 'Arvada', area: '',   lat: 39.8027, lng: -105.0894 },
  { slug: 'arvada-westwoods',      label: 'Westwoods',        city: 'Arvada', area: '',   lat: 39.8364, lng: -105.1647 },
  { slug: 'arvada-candelas',       label: 'Candelas',         city: 'Arvada', area: '',   lat: 39.8703, lng: -105.1808 },

  // ═══ Westminster ═══
  { slug: 'westminster',           label: 'Westminster',      city: 'Westminster', area: '', lat: 39.8367, lng: -105.0372 },
  { slug: 'westminster-bradburn',  label: 'Bradburn Village', city: 'Westminster', area: '', lat: 39.8853, lng: -105.0339 },

  // ═══ Thornton ═══
  { slug: 'thornton',              label: 'Thornton',         city: 'Thornton', area: '',  lat: 39.8680, lng: -104.9719 },

  // ═══ Northglenn ═══
  { slug: 'northglenn',            label: 'Northglenn',       city: 'Northglenn', area: '',lat: 39.8964, lng: -104.9811 },

  // ═══ Broomfield ═══
  { slug: 'broomfield',            label: 'Broomfield',       city: 'Broomfield', area: '',lat: 39.9205, lng: -105.0867 },

  // ═══ Commerce City ═══
  { slug: 'commerce-city',         label: 'Commerce City',    city: 'Commerce City', area: '', lat: 39.8083, lng: -104.9339 },

  // ═══ Golden ═══
  { slug: 'golden',                label: 'Golden',           city: 'Golden', area: '',    lat: 39.7555, lng: -105.2211 },

  // ═══ Englewood ═══
  { slug: 'englewood',             label: 'Englewood',        city: 'Englewood', area: '', lat: 39.6478, lng: -104.9878 },
  { slug: 'cherry-hills-village',  label: 'Cherry Hills Village', city: 'Englewood', area: '', lat: 39.6411, lng: -104.9528 },

  // ═══ Greenwood Village ═══
  { slug: 'greenwood-village',     label: 'Greenwood Village', city: 'Greenwood Village', area: '', lat: 39.6172, lng: -104.9508 },

  // ═══ Centennial ═══
  { slug: 'centennial',            label: 'Centennial',       city: 'Centennial', area: '',lat: 39.5807, lng: -104.8772 },
  { slug: 'centennial-willow',     label: 'Willow Creek',     city: 'Centennial', area: '',lat: 39.5919, lng: -104.8889 },

  // ═══ Littleton ═══
  { slug: 'littleton-downtown',    label: 'Downtown Littleton', city: 'Littleton', area: '', lat: 39.6133, lng: -105.0167 },
  { slug: 'littleton-ken-caryl',   label: 'Ken Caryl',          city: 'Littleton', area: '', lat: 39.5697, lng: -105.1144 },
  { slug: 'littleton-columbine',   label: 'Columbine',          city: 'Littleton', area: '', lat: 39.5933, lng: -105.0731 },
  { slug: 'littleton-bowles',      label: 'Bowles Crossing',    city: 'Littleton', area: '', lat: 39.5994, lng: -105.0856 },
  { slug: 'littleton-roxborough',  label: 'Roxborough Park',    city: 'Littleton', area: '', lat: 39.4727, lng: -105.0825 },

  // ═══ Highlands Ranch ═══
  { slug: 'highlands-ranch',       label: 'Highlands Ranch',  city: 'Highlands Ranch', area: '', lat: 39.5539, lng: -104.9689 },

  // ═══ Lone Tree ═══
  { slug: 'lone-tree',             label: 'Lone Tree',        city: 'Lone Tree', area: '', lat: 39.5572, lng: -104.8861 },

  // ═══ Parker ═══
  { slug: 'parker',                label: 'Parker',           city: 'Parker', area: '',    lat: 39.5186, lng: -104.7614 },
  { slug: 'parker-stonegate',      label: 'Stonegate',        city: 'Parker', area: '',    lat: 39.5567, lng: -104.7872 },
  { slug: 'parker-stroh-ranch',    label: 'Stroh Ranch',      city: 'Parker', area: '',    lat: 39.4836, lng: -104.7497 },

  // ═══ Castle Rock ═══
  { slug: 'castle-rock',           label: 'Castle Rock',      city: 'Castle Rock', area: '', lat: 39.3722, lng: -104.8561 },
  { slug: 'castle-rock-meadows',   label: 'The Meadows',      city: 'Castle Rock', area: '', lat: 39.3919, lng: -104.8975 },
  { slug: 'castle-rock-founders',  label: 'Founders Village', city: 'Castle Rock', area: '', lat: 39.3556, lng: -104.8331 },
];

const BY_SLUG = new Map(NEIGHBORHOODS.map(n => [n.slug, n]));

export function getNeighborhood(slug: string): Neighborhood | null {
  return BY_SLUG.get((slug || '').toLowerCase()) || null;
}

export function resolveNeighborhoodSlug(input: string | null | undefined): string {
  const s = (input || '').toLowerCase().trim();
  if (s === 'all' || !s) return 'all';
  if (BY_SLUG.has(s)) return s;
  return 'all';
}

// Rough miles between two lat/lng pairs (great-circle haversine).
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "Nearby" prefers editorial adjacency. Falls back to closest-by-distance
// (within 8mi for metro reach) for hoods without a curated list.
export function nearbyNeighborhoods(slug: string, maxMiles = 8, limit = 6): Neighborhood[] {
  const here = getNeighborhood(slug);
  if (!here) return [];
  if (here.neighbors && here.neighbors.length > 0) {
    return here.neighbors.map(s => BY_SLUG.get(s)).filter(Boolean).slice(0, limit) as Neighborhood[];
  }
  return NEIGHBORHOODS
    .filter(n => n.slug !== here.slug)
    .map(n => ({ n, mi: milesBetween(here, n) }))
    .filter(x => x.mi <= maxMiles)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, limit)
    .map(x => x.n);
}

// Group neighborhoods for the dropdown picker.
// Denver gets sub-area breakdown (Downtown/Central/Northwest/etc.).
// Suburbs each become their own group.
export function neighborhoodsByCity(): Array<{ label: string; items: Neighborhood[] }> {
  // Preserve insertion order. Denver gets split into "Denver — Area" groups.
  const groups: Array<{ label: string; items: Neighborhood[] }> = [];
  const indexByLabel = new Map<string, number>();

  for (const n of NEIGHBORHOODS) {
    const label = n.city === 'Denver' && n.area ? `Denver — ${n.area}` : n.city;
    let idx = indexByLabel.get(label);
    if (idx === undefined) {
      idx = groups.length;
      indexByLabel.set(label, idx);
      groups.push({ label, items: [] });
    }
    groups[idx].items.push(n);
  }
  return groups;
}
