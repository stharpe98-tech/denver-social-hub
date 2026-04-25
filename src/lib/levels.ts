export const LEVELS = [
  { number: 1, name: "Newcomer",   emoji: "🌱", color: "#6b7a8e", eventsRequired: 0  },
  { number: 2, name: "Regular",    emoji: "⚡", color: "#60a5fa", eventsRequired: 3  },
  { number: 3, name: "Local",      emoji: "🏔️", color: "#8b5cf6", eventsRequired: 8  },
  { number: 4, name: "Connector",  emoji: "🤝", color: "#f59e0b", eventsRequired: 15 },
  { number: 5, name: "Denver OG",  emoji: "👑", color: "#fbbf24", eventsRequired: 25 },
];

export function getLevel(totalEvents = 0) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (totalEvents >= level.eventsRequired) {
      current = level;
    }
  }
  return current;
}

export function getNextLevel(currentLevel: typeof LEVELS[0]) {
  const idx = LEVELS.findIndex(l => l.number === currentLevel.number);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}
