import { getDB } from './db';

const DEFAULTS: Record<string, string> = {
  home_title: 'Meet your people.<br/><em>Explore your city.</em>',
  home_subtitle: 'Denver Social is a free community where members vote on what happens next. No algorithm. Just locals showing up.',
  home_how_title: 'How it works',
  home_how_subtitle: 'Members suggest ideas. The community votes. Top picks become real events.',
  home_types_title: 'What we do',
  home_types_subtitle: 'No experience needed for any of these. Seriously.',
  events_subtitle: 'Dinners, game nights, pottery, hikes — small groups, real plans, no flakes.',
  events_empty: 'Dinners, pottery nights, game nights, hikes — new events drop every week. Post one or join the Discord so you don\'t miss out.',
  login_title: 'Find your people<br/>in Denver.',
  login_subtitle: 'Dinners, pottery, game nights, hikes — small groups, real plans.',
  login_join_title: 'Join the crew',
  login_join_subtitle: 'Free forever. Takes 30 seconds.',
  recs_title: 'Denver Recs',
  recs_subtitle: 'Community-sourced spots. Upvote your favorites — they feed into our events.',
  members_title: 'The Crew',
  members_subtitle: 'Real people. Real plans. No flakes.',
  about_title: 'Look — making friends after college is <em>weird.</em>',
  about_subtitle: 'We\'re just a group of people in Denver who got tired of doom-scrolling on the couch every weekend. So we started doing stuff together. Dinners, hikes, bowling, whatever.',
  conduct_title: 'Just be <em>cool.</em>',
  conduct_subtitle: 'That\'s the whole thing. Everyone\'s here to have a good time. Be yourself, be kind, and don\'t make it weird for anyone else.',
};

export async function getContent(keys?: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = { ...DEFAULTS };
  try {
    const db = getDB();
    if (db) {
      const rows = (await db.prepare("SELECT content_key, content_value FROM site_content").all())?.results || [];
      for (const row of rows as any[]) {
        result[row.content_key] = row.content_value;
      }
    }
  } catch (err) {
    console.error('getContent error:', err);
  }
  return result;
}

export function getDefaults(): Record<string, string> {
  return { ...DEFAULTS };
}
