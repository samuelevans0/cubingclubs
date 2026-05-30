-- Migration: make clubs.user_id nullable and non-unique so admins can create ownerless clubs.
-- SQLite doesn't support ALTER COLUMN, so we recreate the table.
-- Run with: npx wrangler d1 execute DB --remote --file=migrations/nullable_user_id.sql

PRAGMA foreign_keys=OFF;

ALTER TABLE clubs RENAME TO clubs_backup;

CREATE TABLE clubs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL DEFAULT '',
  city              TEXT NOT NULL DEFAULT '',
  country           TEXT NOT NULL DEFAULT '',
  lat               REAL,
  lng               REAL,
  members           INTEGER DEFAULT 0,
  founded           INTEGER,
  website           TEXT DEFAULT '',
  description       TEXT DEFAULT '',
  logo_url          TEXT DEFAULT '',
  photo_url         TEXT DEFAULT '',
  contact           TEXT DEFAULT '',
  address           TEXT DEFAULT '',
  address_line2     TEXT DEFAULT '',
  state             TEXT DEFAULT '',
  postal_code       TEXT DEFAULT '',
  school_type       TEXT DEFAULT '',
  slug              TEXT DEFAULT '',
  meeting_place_name TEXT DEFAULT '',
  youtube           TEXT DEFAULT '',
  instagram         TEXT DEFAULT '',
  tiktok            TEXT DEFAULT '',
  facebook          TEXT DEFAULT '',
  community_group   TEXT DEFAULT '',
  phone             TEXT DEFAULT '',
  approved          INTEGER DEFAULT 0,
  visible           INTEGER DEFAULT 1,
  denial_message    TEXT DEFAULT '',
  def_time          TEXT DEFAULT '',
  def_end_time      TEXT DEFAULT '',
  def_location_name TEXT DEFAULT '',
  def_address       TEXT DEFAULT '',
  def_address_line2 TEXT DEFAULT '',
  def_city          TEXT DEFAULT '',
  def_state         TEXT DEFAULT '',
  def_country       TEXT DEFAULT '',
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

INSERT INTO clubs (
  id, user_id, name, city, country, lat, lng, members, founded,
  website, description, logo_url, photo_url, contact,
  address, address_line2, state, postal_code, school_type,
  slug, meeting_place_name,
  youtube, instagram, tiktok, facebook, community_group, phone,
  approved, visible, denial_message,
  def_time, def_end_time, def_location_name,
  def_address, def_address_line2, def_city, def_state, def_country,
  created_at, updated_at
)
SELECT
  id, user_id, name, city, country, lat, lng, members, founded,
  website, description, logo_url, photo_url, contact,
  address, address_line2, state, postal_code, school_type,
  slug, meeting_place_name,
  youtube, instagram, tiktok, facebook, community_group, phone,
  approved, visible, denial_message,
  def_time, def_end_time, def_location_name,
  def_address, def_address_line2, def_city, def_state, def_country,
  created_at, updated_at
FROM clubs_backup;

DROP TABLE clubs_backup;

PRAGMA foreign_keys=ON;
