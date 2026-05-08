-- Add user_preferences JSONB column to app_users.
-- Stores per-user format and quality preferences used during import candidate
-- evaluation and download result scoring.
--
-- Default: empty object.  Application layer normalises missing keys to 'any'.

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS user_preferences JSONB NOT NULL DEFAULT '{}';
