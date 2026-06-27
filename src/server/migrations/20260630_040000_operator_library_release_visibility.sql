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

CREATE TABLE IF NOT EXISTS operator_library_release_visibility (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  visibility_state TEXT NOT NULL DEFAULT 'visible',
  reason TEXT NULL,
  removed_at TIMESTAMPTZ NULL,
  restored_at TIMESTAMPTZ NULL,
  updated_by_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operator_library_release_visibility_user_release_unique UNIQUE (
    app_user_id,
    metadata_release_id
  ),
  CONSTRAINT operator_library_release_visibility_state_check CHECK (
    visibility_state IN ('visible', 'removed')
  )
);

CREATE INDEX IF NOT EXISTS operator_library_release_visibility_user_state_idx
  ON operator_library_release_visibility (app_user_id, visibility_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS operator_library_release_visibility_release_idx
  ON operator_library_release_visibility (metadata_release_id, updated_at DESC);
