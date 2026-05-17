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
  { slug: 'lodo',          label: 'LoDo',           city: 'Denver', area: 'Downtown',     lat: 39.7530, lng: -104.9990, neighbors: ['rino','lohi','capitol-hill','five-points'] },
  { slug: 'rino',          label: 'RiNo',           city: 'Denver', area: 'Downtown',     lat: 39.7707, lng: -104.9819, neighbors: ['five-points','lodo','lohi','capitol-hill','cherry-creek'] },
  { slug: 'lohi',          label: 'LoHi',           city: 'Denver', area: 'Downtown',     lat: 39.7587, lng: -105.0085, neighbors: ['lodo','highlands','rino','speer'] },

  // ═══ Denver — Central ═══
  { slug: 'five-points',   label: 'Five Points',    city: 'Denver', area: 'Central',      lat: 39.7593, lng: -104.9794, neighbors: ['rino','capitol-hill','city-park','lodo'] },
  { slug: 'capitol-hill',  label: 'Capitol Hill',   city: 'Denver', area: 'Central',      lat: 39.7355, lng: -104.9787, neighbors: ['cherry-creek','speer','five-points','congress-park','rino'] },
  { slug: 'speer',         label: 'Speer',          city: 'Denver', area: 'Central',      lat: 39.7235, lng: -104.9851, neighbors: ['capitol-hill','baker','lohi','wash-park'] },

  // ═══ Denver — Northwest ═══
  { slug: 'highlands',     label: 'Highlands',      city: 'Denver', area: 'Northwest',    lat: 39.7647, lng: -105.0178, neighbors: ['lohi','sloans-lake','berkeley'] },
  { slug: 'berkeley',      label: 'Berkeley',       city: 'Denver', area: 'Northwest',    lat: 39.7795, lng: -105.0420, neighbors: ['highlands','sloans-lake'] },
  { slug: 'sloans-lake',   label: "Sloan's Lake",   city: 'Denver', area: 'Northwest',    lat: 39.7497, lng: -105.0494, neighbors: ['highlands','berkeley','edgewater'] },

  // ═══ Denver — East ═══
  { slug: 'city-park',     label: 'City Park',      city: 'Denver', area: 'East',         lat: 39.7475, lng: -104.9476, neighbors: ['five-points','congress-park','park-hill'] },
  { slug: 'congress-park', label: 'Congress Park',  city: 'Denver', area: 'East',         lat: 39.7349, lng: -104.9554, neighbors: ['cherry-creek','capitol-hill','city-park','hilltop'] },
  { slug: 'park-hill',     label: 'Park Hill',      city: 'Denver', area: 'East',         lat: 39.7497, lng: -104.9214, neighbors: ['city-park','stapleton','lowry'] },
  { slug: 'cherry-creek',  label: 'Cherry Creek',   city: 'Denver', area: 'East',         lat: 39.7180, lng: -104.9540, neighbors: ['capitol-hill','wash-park','hilltop','congress-park','rino'] },
  { slug: 'hilltop',       label: 'Hilltop',        city: 'Denver', area: 'East',         lat: 39.7176, lng: -104.9335, neighbors: ['cherry-creek','congress-park','lowry','virginia-vale'] },

  // ═══ Denver — Northeast ═══
  { slug: 'stapleton',     label: 'Central Park',   city: 'Denver', area: 'Northeast',    lat: 39.7656, lng: -104.8929, neighbors: ['park-hill','lowry','green-valley'] },
  { slug: 'lowry',         label: 'Lowry',          city: 'Denver', area: 'Northeast',    lat: 39.7172, lng: -104.8970, neighbors: ['park-hill','hilltop','stapleton','virginia-vale'] },
  { slug: 'green-valley',  label: 'Green Valley Ranch', city: 'Denver', area: 'Northeast', lat: 39.7913, lng: -104.7654, neighbors: ['stapleton','dia'] },
  { slug: 'dia',           label: 'DIA / Gateway',  city: 'Denver', area: 'Northeast',    lat: 39.8617, lng: -104.6731, neighbors: ['green-valley'] },

  // ═══ Denver — South ═══
  { slug: 'wash-park',     label: 'Wash Park',      city: 'Denver', area: 'South',        lat: 39.7008, lng: -104.9701, neighbors: ['baker','platt-park','speer','cherry-creek'] },
  { slug: 'baker',         label: 'Baker',          city: 'Denver', area: 'South',        lat: 39.7203, lng: -104.9923, neighbors: ['wash-park','speer','platt-park'] },
  { slug: 'platt-park',    label: 'Platt Park',     city: 'Denver', area: 'South',        lat: 39.6810, lng: -104.9836, neighbors: ['wash-park','baker','university'] },
  { slug: 'university',    label: 'University',     city: 'Denver', area: 'South',        lat: 39.6776, lng: -104.9621, neighbors: ['platt-park','wellshire','virginia-vale'] },
  { slug: 'wellshire',     label: 'Wellshire',      city: 'Denver', area: 'South',        lat: 39.6650, lng: -104.9595, neighbors: ['university','platt-park'] },
  { slug: 'virginia-vale', label: 'Virginia Vale',  city: 'Denver', area: 'Southeast',    lat: 39.6929, lng: -104.9163, neighbors: ['lowry','hilltop','university'] },
  { slug: 'westwood',      label: 'Westwood',       city: 'Denver', area: 'Southwest',    lat: 39.6918, lng: -105.0411 },

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
  if (s === 'all') return 'all';
  if (s && BY_SLUG.has(s)) return s;
  return 'wash-park';
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
