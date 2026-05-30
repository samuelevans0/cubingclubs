-- Add club photo column
-- Run with: npx wrangler d1 execute DB --remote --file=migrations/add_photo_url.sql

ALTER TABLE clubs ADD COLUMN photo_url TEXT NOT NULL DEFAULT '';
