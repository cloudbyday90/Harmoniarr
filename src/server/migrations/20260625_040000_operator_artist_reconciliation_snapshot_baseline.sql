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

CREATE TABLE IF NOT EXISTS operator_artist_reconciliation_snapshot (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  snapshot_revision BIGINT NOT NULL CHECK (snapshot_revision > 0),
  snapshot_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operator_artist_reconciliation_snapshot_revision_unique UNIQUE (
    app_user_id,
    metadata_artist_id,
    snapshot_revision
  ),
  CONSTRAINT operator_artist_reconciliation_snapshot_payload_object_check CHECK (
    jsonb_typeof(snapshot_payload) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS operator_artist_reconciliation_snapshot_latest_idx
  ON operator_artist_reconciliation_snapshot (app_user_id, metadata_artist_id, snapshot_revision DESC);
