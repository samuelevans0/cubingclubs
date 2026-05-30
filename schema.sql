-- Run with: wrangler d1 execute globalcubing --file=schema.sql
-- Account system migrations (run on existing DB):
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE users ADD COLUMN verification_token TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE users ADD COLUMN verification_token_expires TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE users ADD COLUMN reset_token TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE users ADD COLUMN reset_token_expires TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE users ADD COLUMN pending_email TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE users ADD COLUMN email_change_token TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE users ADD COLUMN email_change_token_expires TEXT DEFAULT ''"
-- IMPORTANT: grandfather in existing accounts as verified:
-- wrangler d1 execute globalcubing --remote --command="UPDATE users SET email_verified = 1"
--
-- New column migrations:
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN address_line2 TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN postal_code TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN school_type TEXT DEFAULT ''"
-- Migrations for existing DBs:
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN visible INTEGER DEFAULT 1"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN address TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN state TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN youtube TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN instagram TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN tiktok TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN facebook TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN community_group TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN phone TEXT DEFAULT ''"
-- wrangler d1 execute globalcubing --remote --command="ALTER TABLE clubs ADD COLUMN denial_message TEXT DEFAULT ''"

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin    INTEGER DEFAULT 0,
  email_verified INTEGER DEFAULT 0,
  verification_token TEXT DEFAULT '',
  verification_token_expires TEXT DEFAULT '',
  reset_token TEXT DEFAULT '',
  reset_token_expires TEXT DEFAULT '',
  pending_email TEXT DEFAULT '',
  email_change_token TEXT DEFAULT '',
  email_change_token_expires TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clubs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER UNIQUE NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  lat         REAL,
  lng         REAL,
  members     INTEGER DEFAULT 0,
  founded     INTEGER,
  website     TEXT DEFAULT '',
  description TEXT DEFAULT '',
  logo_url    TEXT DEFAULT '',
  contact     TEXT DEFAULT '',
  address     TEXT DEFAULT '',
  address_line2 TEXT DEFAULT '',
  state       TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  school_type TEXT DEFAULT '',
  youtube     TEXT DEFAULT '',
  instagram   TEXT DEFAULT '',
  tiktok      TEXT DEFAULT '',
  facebook    TEXT DEFAULT '',
  community_group TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  approved    INTEGER DEFAULT 0,
  visible     INTEGER DEFAULT 1,
  denial_message TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT ''
);
