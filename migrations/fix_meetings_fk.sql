-- Fix meetings table foreign key which incorrectly references clubs_backup after the nullable_user_id migration.
-- Recreates meetings with the correct FK pointing to clubs.

PRAGMA foreign_keys=OFF;

ALTER TABLE meetings RENAME TO meetings_backup;

CREATE TABLE meetings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id       INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  meeting_type  TEXT DEFAULT '',
  date          TEXT NOT NULL,
  time          TEXT DEFAULT '',
  end_time      TEXT DEFAULT '',
  location_name TEXT NOT NULL DEFAULT '',
  address       TEXT DEFAULT '',
  address_line2 TEXT DEFAULT '',
  city          TEXT DEFAULT '',
  state         TEXT DEFAULT '',
  country       TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  created_at    TEXT DEFAULT (datetime('now'))
);

INSERT INTO meetings (id, club_id, meeting_type, date, time, end_time, location_name, address, address_line2, city, state, country, notes, created_at)
SELECT                id, club_id, meeting_type, date, time, end_time, location_name, address, address_line2, city, state, country, notes, created_at
FROM meetings_backup;

DROP TABLE meetings_backup;

PRAGMA foreign_keys=ON;
