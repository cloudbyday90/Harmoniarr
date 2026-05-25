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

CREATE TABLE IF NOT EXISTS operator_artist_monitoring (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  is_monitored BOOLEAN NOT NULL DEFAULT FALSE,
  monitored_release_group_types TEXT[] NOT NULL DEFAULT ARRAY['album', 'ep']::text[],
  release_scope TEXT NOT NULL DEFAULT 'future_only',
  wanted_automation_mode TEXT NOT NULL DEFAULT 'future_matching',
  acquisition_profile_key TEXT NOT NULL DEFAULT 'balanced_library',
  search_on_add_mode TEXT NOT NULL DEFAULT 'none',
  selection_source_mode TEXT NOT NULL DEFAULT 'policy_only',
  last_reconciled_at TIMESTAMPTZ NULL,
  last_saved_snapshot_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operator_artist_monitoring_user_artist_unique UNIQUE (app_user_id, metadata_artist_id),
  CONSTRAINT operator_artist_monitoring_release_group_types_check CHECK (
    cardinality(monitored_release_group_types) > 0
    AND monitored_release_group_types <@ ARRAY[
      'album',
      'ep',
      'single',
      'compilation',
      'live',
      'other'
    ]::text[]
  ),
  CONSTRAINT operator_artist_monitoring_release_scope_check CHECK (
    release_scope IN ('track_only', 'future_only', 'current_and_future')
  ),
  CONSTRAINT operator_artist_monitoring_wanted_automation_mode_check CHECK (
    wanted_automation_mode IN ('manual_only', 'future_matching', 'current_and_future_matching')
  ),
  CONSTRAINT operator_artist_monitoring_acquisition_profile_key_check CHECK (
    acquisition_profile_key IN ('balanced_library', 'lossless_archive', 'apple_friendly_portable', 'storage_saver')
  ),
  CONSTRAINT operator_artist_monitoring_search_on_add_mode_check CHECK (
    search_on_add_mode IN ('none', 'missing_now')
  ),
  CONSTRAINT operator_artist_monitoring_selection_source_mode_check CHECK (
    selection_source_mode IN ('policy_only', 'policy_plus_overrides')
  )
);

CREATE INDEX IF NOT EXISTS operator_artist_monitoring_user_monitored_idx
  ON operator_artist_monitoring (app_user_id, is_monitored, updated_at DESC);

CREATE INDEX IF NOT EXISTS operator_artist_monitoring_artist_idx
  ON operator_artist_monitoring (metadata_artist_id, updated_at DESC);
