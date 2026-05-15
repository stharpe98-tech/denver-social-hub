// Group posts: between-event chatter for members of a Group.
// - posts:     short text from a group member
// - comments:  flat thread under each post (not threaded — keep it simple)
// - reactions: one 👍-style reaction per member per post

export async function ensureGroupPostsSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS group_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      author_email TEXT NOT NULL,
      author_name TEXT,
      body TEXT NOT NULL,
      pinned INTEGER DEFAULT 0,
      reaction_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      edited_at TEXT
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_group_posts_group ON group_posts(group_id, pinned DESC, id DESC)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS group_post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_email TEXT NOT NULL,
      author_name TEXT,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_group_post_comments_post ON group_post_comments(post_id, id)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS group_post_reactions (
      post_id INTEGER NOT NULL,
      member_email TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, member_email)
    )
  `).run();
}
