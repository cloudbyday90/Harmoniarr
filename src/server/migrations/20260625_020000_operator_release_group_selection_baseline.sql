--
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

CREATE TABLE IF NOT EXISTS operator_release_group_selection (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  selection_state TEXT NOT NULL DEFAULT 'selected',
  resolved_metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL,
  selection_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operator_release_group_selection_user_release_group_unique UNIQUE (
    app_user_id,
    metadata_release_group_id
  ),
  CONSTRAINT operator_release_group_selection_state_check CHECK (
    selection_state IN ('unselected', 'selected', 'partial')
  ),
  CONSTRAINT operator_release_group_selection_source_check CHECK (
    selection_source IN ('manual', 'policy')
  )
);

CREATE INDEX IF NOT EXISTS operator_release_group_selection_user_artist_state_idx
  ON operator_release_group_selection (app_user_id, metadata_artist_id, selection_state);

CREATE INDEX IF NOT EXISTS operator_release_group_selection_release_group_idx
  ON operator_release_group_selection (metadata_release_group_id);
