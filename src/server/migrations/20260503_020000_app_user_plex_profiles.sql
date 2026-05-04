-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

CREATE TABLE IF NOT EXISTS app_user_plex_profiles (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  app_user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  plex_user_id TEXT NOT NULL UNIQUE,
  plex_uuid TEXT NULL UNIQUE,
  plex_username TEXT NULL,
  plex_email TEXT NULL,
  plex_title TEXT NOT NULL,
  plex_thumb_url TEXT NULL,
  plex_home_role TEXT NOT NULL,
  plex_library_access_state TEXT NOT NULL DEFAULT 'unknown',
  plex_library_access_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_user_plex_profiles_app_user_id_idx
  ON app_user_plex_profiles (app_user_id);

CREATE INDEX IF NOT EXISTS app_user_plex_profiles_home_role_idx
  ON app_user_plex_profiles (plex_home_role);

CREATE INDEX IF NOT EXISTS app_user_plex_profiles_library_access_state_idx
  ON app_user_plex_profiles (plex_library_access_state);

CREATE INDEX IF NOT EXISTS app_user_plex_profiles_email_idx
  ON app_user_plex_profiles (lower(plex_email))
  WHERE plex_email IS NOT NULL;
