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



-- Harmoniarr schema snapshot

-- Generated from the accepted timestamped migration lineage.

-- Refresh with: npm run update:schema-snapshot



CREATE EXTENSION IF NOT EXISTS pgcrypto;



CREATE TABLE IF NOT EXISTS schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  duration_ms INTEGER NULL,
  error_message TEXT NULL,
  application_version TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- Migration: 20260427_000001_bootstrap_core_tables.sql
-- Checksum: fe1f01de8242169316218ad4a91b67c83e99d241b17adfcab3121d5e3153450f
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

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_runtime_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS path_contracts (
  key TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO path_contracts (key, path, description)
VALUES
  ('app_data', '/app/data', 'Persistent application state, embedded PostgreSQL, and generated runtime files.'),
  ('downloads', '/data/downloads', 'Shared slskd download tree that Harmoniarr inspects before import.'),
  ('music', '/data/music', 'Final managed music library root.'),
  ('staging', '/data/staging', 'Pre-import review, quarantine, and validation workspace.'),
  ('transcode_temp', '/data/transcode-temp', 'Scratch directory reserved for future media processing jobs.')
ON CONFLICT (key) DO UPDATE
SET path = EXCLUDED.path,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  password_changed_at TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_family_id UUID NOT NULL,
  parent_refresh_token_id UUID NULL REFERENCES refresh_tokens(id),
  csrf_token_hash TEXT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL,
  issued_ip INET NULL,
  issued_user_agent TEXT NULL,
  replaced_by_refresh_token_id UUID NULL REFERENCES refresh_tokens(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  encrypted_key_preview TEXT NULL,
  scope TEXT NOT NULL,
  last_used_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_type TEXT NOT NULL,
  name TEXT NOT NULL,
  encrypted_value BYTEA NOT NULL,
  encryption_key_version TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL,
  actor_user_id UUID NULL REFERENCES app_users(id),
  actor_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NULL,
  entity_id UUID NULL,
  summary TEXT NOT NULL,
  details JSONB NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  updated_by_user_id UUID NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(namespace, setting_key)
);

CREATE TABLE IF NOT EXISTS maintenance_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_type TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_instance_id TEXT NULL,
  reason TEXT NULL,
  acquired_by_user_id UUID NULL REFERENCES app_users(id),
  acquired_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  released_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_recovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL,
  recovery_code_hash TEXT NOT NULL,
  armed_via TEXT NOT NULL,
  armed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  invalid_attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  completed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  created_admin_user_id UUID NULL REFERENCES app_users(id),
  completed_from_ip INET NULL,
  completed_user_agent TEXT NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NULL,
  triggered_by_user_id UUID NULL REFERENCES app_users(id),
  correlation_id UUID NULL,
  summary JSONB NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  lease_key TEXT NOT NULL UNIQUE,
  owner_instance_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_runtime_state (key, value)
VALUES
  ('bootstrap', '{"status":"ready","source":"20260427_000001_bootstrap_core_tables.sql"}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260427_000001',
  '20260427_000001_bootstrap_core_tables.sql',
  'bootstrap_core_tables',
  'fe1f01de8242169316218ad4a91b67c83e99d241b17adfcab3121d5e3153450f',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260428_000001_artwork_asset_foundation.sql
-- Checksum: d310afd6faa4ac5f054619114fb138ace4ff00178e5f3a19e746dbd163b4859c
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

INSERT INTO path_contracts (key, path, description)
VALUES
  ('artwork', '/app/data/artwork', 'App-owned artwork originals, derivatives, extracted durable copies, and temporary processing workspace.')
ON CONFLICT (key) DO UPDATE
SET path = EXCLUDED.path,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS artwork_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_namespace TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  width INTEGER NULL CHECK (width IS NULL OR width > 0),
  height INTEGER NULL CHECK (height IS NULL OR height > 0),
  storage_class TEXT NOT NULL,
  source_provider TEXT NULL,
  source_url TEXT NULL,
  payload_checksum TEXT NULL,
  fetched_at TIMESTAMPTZ NULL,
  last_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (storage_namespace, relative_path),
  UNIQUE (sha256)
);

CREATE TABLE IF NOT EXISTS artwork_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_asset_id UUID NOT NULL REFERENCES artwork_assets(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  artwork_role TEXT NOT NULL,
  source_provider TEXT NULL,
  source_reference TEXT NULL,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 100,
  observed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_type, owner_id, artwork_role, artwork_asset_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS artwork_assignments_one_preferred_per_owner_role
  ON artwork_assignments (owner_type, owner_id, artwork_role)
  WHERE is_preferred = TRUE;

CREATE INDEX IF NOT EXISTS artwork_assignments_owner_lookup_idx
  ON artwork_assignments (owner_type, owner_id, priority ASC, created_at ASC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260428_000001',
  '20260428_000001_artwork_asset_foundation.sql',
  'artwork_asset_foundation',
  'd310afd6faa4ac5f054619114fb138ace4ff00178e5f3a19e746dbd163b4859c',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260428_000002_canonical_metadata_foundation.sql
-- Checksum: 81a11a79752aaf753a7df9b09677f29d4e36eddd54b0b469ba081cd7646a84c3
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

CREATE TABLE IF NOT EXISTS metadata_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider TEXT NOT NULL,
  source_artist_id TEXT NOT NULL,
  musicbrainz_artist_id UUID NULL,
  name TEXT NOT NULL,
  sort_name TEXT NULL,
  disambiguation TEXT NULL,
  country TEXT NULL,
  artist_type TEXT NULL,
  begin_date TEXT NULL,
  end_date TEXT NULL,
  raw_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_artist_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_artists_musicbrainz_artist_id_unique
  ON metadata_artists (musicbrainz_artist_id)
  WHERE musicbrainz_artist_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS metadata_artist_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  locale TEXT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_artist_aliases_artist_alias_locale_unique
  ON metadata_artist_aliases (metadata_artist_id, alias, COALESCE(locale, ''));

CREATE INDEX IF NOT EXISTS metadata_artist_aliases_artist_lookup_idx
  ON metadata_artist_aliases (metadata_artist_id, is_primary DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS metadata_release_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_release_group_id TEXT NOT NULL,
  musicbrainz_release_group_id UUID NULL,
  title TEXT NOT NULL,
  primary_type TEXT NULL,
  secondary_types TEXT[] NOT NULL DEFAULT '{}',
  first_release_date TEXT NULL,
  disambiguation TEXT NULL,
  raw_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_release_group_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_release_groups_musicbrainz_release_group_id_unique
  ON metadata_release_groups (musicbrainz_release_group_id)
  WHERE musicbrainz_release_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS metadata_release_groups_artist_lookup_idx
  ON metadata_release_groups (metadata_artist_id, created_at ASC);

CREATE TABLE IF NOT EXISTS metadata_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_release_id TEXT NOT NULL,
  musicbrainz_release_id UUID NULL,
  title TEXT NOT NULL,
  status TEXT NULL,
  release_date TEXT NULL,
  country TEXT NULL,
  barcode TEXT NULL,
  disambiguation TEXT NULL,
  track_count INTEGER NULL CHECK (track_count IS NULL OR track_count >= 0),
  medium_count INTEGER NULL CHECK (medium_count IS NULL OR medium_count >= 0),
  raw_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_release_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_releases_musicbrainz_release_id_unique
  ON metadata_releases (musicbrainz_release_id)
  WHERE musicbrainz_release_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS metadata_releases_release_group_lookup_idx
  ON metadata_releases (metadata_release_group_id, created_at ASC);

CREATE TABLE IF NOT EXISTS metadata_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  title TEXT NULL,
  format TEXT NULL,
  track_count INTEGER NULL CHECK (track_count IS NULL OR track_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_release_id, position)
);

CREATE INDEX IF NOT EXISTS metadata_media_release_lookup_idx
  ON metadata_media (metadata_release_id, position ASC);

CREATE TABLE IF NOT EXISTS metadata_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider TEXT NOT NULL,
  source_recording_id TEXT NOT NULL,
  musicbrainz_recording_id UUID NULL,
  title TEXT NOT NULL,
  length_ms INTEGER NULL CHECK (length_ms IS NULL OR length_ms >= 0),
  artist_credit TEXT NULL,
  raw_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_recording_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS metadata_recordings_musicbrainz_recording_id_unique
  ON metadata_recordings (musicbrainz_recording_id)
  WHERE musicbrainz_recording_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS metadata_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_medium_id UUID NOT NULL REFERENCES metadata_media(id) ON DELETE CASCADE,
  metadata_recording_id UUID NULL REFERENCES metadata_recordings(id) ON DELETE SET NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  number_text TEXT NULL,
  title TEXT NOT NULL,
  length_ms INTEGER NULL CHECK (length_ms IS NULL OR length_ms >= 0),
  artist_credit TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_medium_id, position)
);

CREATE INDEX IF NOT EXISTS metadata_tracks_medium_lookup_idx
  ON metadata_tracks (metadata_medium_id, position ASC);

CREATE INDEX IF NOT EXISTS metadata_tracks_recording_lookup_idx
  ON metadata_tracks (metadata_recording_id)
  WHERE metadata_recording_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS metadata_provider_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NULL,
  source_identifier TEXT NULL,
  payload_checksum TEXT NULL,
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metadata_provider_snapshots_entity_lookup_idx
  ON metadata_provider_snapshots (provider, entity_type, entity_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS metadata_provider_snapshots_source_identifier_lookup_idx
  ON metadata_provider_snapshots (provider, source_identifier, fetched_at DESC)
  WHERE source_identifier IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260428_000002',
  '20260428_000002_canonical_metadata_foundation.sql',
  'canonical_metadata_foundation',
  '81a11a79752aaf753a7df9b09677f29d4e36eddd54b0b469ba081cd7646a84c3',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260428_000003_metadata_local_search_indexes.sql
-- Checksum: ed2354df96432a2af757a6680bcab3255535047037c0e3e1481639e49bc4e922
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

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS metadata_artists_name_trgm_idx
  ON metadata_artists USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS metadata_artists_sort_name_trgm_idx
  ON metadata_artists USING GIN (sort_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS metadata_release_groups_title_trgm_idx
  ON metadata_release_groups USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS metadata_releases_title_trgm_idx
  ON metadata_releases USING GIN (title gin_trgm_ops);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260428_000003',
  '20260428_000003_metadata_local_search_indexes.sql',
  'metadata_local_search_indexes',
  'ed2354df96432a2af757a6680bcab3255535047037c0e3e1481639e49bc4e922',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000001_import_candidate_foundation.sql
-- Checksum: 5c34acbfdd410c68c68b583af1e4d8444bf47e3596ee8129995e597f2ec971d8
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

CREATE TABLE IF NOT EXISTS import_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider TEXT NOT NULL,
  source_search_id TEXT NOT NULL,
  source_response_key TEXT NOT NULL,
  username TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  candidate_type TEXT NOT NULL DEFAULT 'manual_search',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'held', 'rejected', 'selected', 'applied', 'failed')),
  file_count INTEGER NOT NULL DEFAULT 0 CHECK (file_count >= 0),
  locked_file_count INTEGER NOT NULL DEFAULT 0 CHECK (locked_file_count >= 0),
  total_size_bytes BIGINT NULL CHECK (total_size_bytes IS NULL OR total_size_bytes >= 0),
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_provider, source_search_id, source_response_key)
);

CREATE INDEX IF NOT EXISTS import_candidates_status_discovered_idx
  ON import_candidates (status, discovered_at DESC);

CREATE INDEX IF NOT EXISTS import_candidates_source_search_idx
  ON import_candidates (source_provider, source_search_id, discovered_at DESC);

CREATE INDEX IF NOT EXISTS import_candidates_username_folder_idx
  ON import_candidates (username, folder_path);

CREATE INDEX IF NOT EXISTS import_candidates_normalized_payload_gin_idx
  ON import_candidates USING GIN (normalized_payload jsonb_path_ops);

CREATE TABLE IF NOT EXISTS import_candidate_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  source_file_index INTEGER NOT NULL CHECK (source_file_index >= 0),
  filename TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  extension TEXT NULL,
  size_bytes BIGINT NULL CHECK (size_bytes IS NULL OR size_bytes >= 0),
  bit_rate_kbps INTEGER NULL CHECK (bit_rate_kbps IS NULL OR bit_rate_kbps >= 0),
  bit_depth INTEGER NULL CHECK (bit_depth IS NULL OR bit_depth >= 0),
  length_seconds INTEGER NULL CHECK (length_seconds IS NULL OR length_seconds >= 0),
  sample_rate_hz INTEGER NULL CHECK (sample_rate_hz IS NULL OR sample_rate_hz >= 0),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_candidate_id, source_file_index)
);

CREATE INDEX IF NOT EXISTS import_candidate_files_candidate_idx
  ON import_candidate_files (import_candidate_id, source_file_index);

CREATE INDEX IF NOT EXISTS import_candidate_files_extension_idx
  ON import_candidate_files (extension)
  WHERE extension IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000001',
  '20260430_000001_import_candidate_foundation.sql',
  'import_candidate_foundation',
  '5c34acbfdd410c68c68b583af1e4d8444bf47e3596ee8129995e597f2ec971d8',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000002_import_candidate_review_events.sql
-- Checksum: 1ae9688ae3e3740e9ea54c8f6dafaef12c099bc3698c051a7198d52dfc9d9006
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

CREATE TABLE IF NOT EXISTS import_candidate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT NULL,
  new_status TEXT NULL,
  reason TEXT NULL,
  actor_user_id UUID NULL REFERENCES app_users(id),
  details JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_candidate_events_candidate_idx
  ON import_candidate_events (import_candidate_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS import_candidate_events_type_occurred_idx
  ON import_candidate_events (event_type, occurred_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000002',
  '20260430_000002_import_candidate_review_events.sql',
  'import_candidate_review_events',
  '1ae9688ae3e3740e9ea54c8f6dafaef12c099bc3698c051a7198d52dfc9d9006',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000003_library_catalog_foundation.sql
-- Checksum: b18efdef348a6cab5c208a48722d9b14094e18f2baced920e35ead4ae4ddd567
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

CREATE TABLE IF NOT EXISTS library_roots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  canonical_path TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quality_profile_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS library_roots_enabled_idx
  ON library_roots (is_enabled, updated_at DESC);

CREATE TABLE IF NOT EXISTS library_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_root_id UUID NOT NULL REFERENCES library_roots(id) ON DELETE CASCADE,
  canonical_path TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  modified_at TIMESTAMPTZ NULL,
  audio_codec TEXT NULL,
  bitrate_kbps INTEGER NULL CHECK (bitrate_kbps IS NULL OR bitrate_kbps >= 0),
  sample_rate_hz INTEGER NULL CHECK (sample_rate_hz IS NULL OR sample_rate_hz >= 0),
  bit_depth INTEGER NULL CHECK (bit_depth IS NULL OR bit_depth >= 0),
  channels INTEGER NULL CHECK (channels IS NULL OR channels >= 0),
  duration_ms INTEGER NULL CHECK (duration_ms IS NULL OR duration_ms >= 0),
  tag_payload JSONB NULL,
  file_state TEXT NOT NULL DEFAULT 'observed'
    CHECK (file_state IN ('observed', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS library_files_root_state_idx
  ON library_files (library_root_id, file_state, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS library_files_root_relative_idx
  ON library_files (library_root_id, relative_path)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS library_files_deleted_idx
  ON library_files (library_root_id, deleted_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000003',
  '20260430_000003_library_catalog_foundation.sql',
  'library_catalog_foundation',
  'b18efdef348a6cab5c208a48722d9b14094e18f2baced920e35ead4ae4ddd567',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000004_library_file_tag_snapshots.sql
-- Checksum: 9d8e14fe3bd8cdbb9cedc1b7f43573c1ba54abe12fac8095a9205167d53a7fde
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

CREATE TABLE IF NOT EXISTS file_tag_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_file_id UUID NOT NULL REFERENCES library_files(id) ON DELETE CASCADE,
  extractor TEXT NOT NULL,
  extractor_version TEXT NULL,
  tag_format TEXT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('extracted', 'failed')),
  embedded_artwork_count INTEGER NULL
    CHECK (embedded_artwork_count IS NULL OR embedded_artwork_count >= 0),
  raw_tags JSONB NULL,
  normalized_tags JSONB NULL,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS file_tag_snapshots_library_file_idx
  ON file_tag_snapshots (library_file_id, extracted_at DESC);

CREATE INDEX IF NOT EXISTS file_tag_snapshots_status_idx
  ON file_tag_snapshots (status, extracted_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000004',
  '20260430_000004_library_file_tag_snapshots.sql',
  'library_file_tag_snapshots',
  '9d8e14fe3bd8cdbb9cedc1b7f43573c1ba54abe12fac8095a9205167d53a7fde',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000005_library_file_match_baseline.sql
-- Checksum: 3edb0951e02cda506413b6427925bcdc2c4df74f4568136024874fc953650790
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

CREATE TABLE IF NOT EXISTS library_file_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_file_id UUID NOT NULL REFERENCES library_files(id) ON DELETE CASCADE,
  metadata_artist_id UUID NULL REFERENCES metadata_artists(id) ON DELETE SET NULL,
  metadata_release_group_id UUID NULL REFERENCES metadata_release_groups(id) ON DELETE SET NULL,
  metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL,
  metadata_medium_id UUID NULL REFERENCES metadata_media(id) ON DELETE SET NULL,
  metadata_track_id UUID NULL REFERENCES metadata_tracks(id) ON DELETE SET NULL,
  metadata_recording_id UUID NULL REFERENCES metadata_recordings(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL
    CHECK (match_status IN ('matched', 'ambiguous', 'unmatched')),
  confidence TEXT NOT NULL
    CHECK (confidence IN ('high', 'medium', 'low')),
  matched_by TEXT NOT NULL,
  evidence JSONB NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (library_file_id)
);

CREATE INDEX IF NOT EXISTS library_file_matches_status_idx
  ON library_file_matches (match_status, matched_at DESC);

CREATE INDEX IF NOT EXISTS library_file_matches_release_idx
  ON library_file_matches (metadata_release_id, metadata_track_id, matched_at DESC)
  WHERE metadata_release_id IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000005',
  '20260430_000005_library_file_match_baseline.sql',
  'library_file_match_baseline',
  '3edb0951e02cda506413b6427925bcdc2c4df74f4568136024874fc953650790',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000006_library_release_reconciliation_baseline.sql
-- Checksum: cdd009c8ffb795b14edabe5e9323a511ce1b0ab6b82fe041d4320e5032dd14d2
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

CREATE TABLE IF NOT EXISTS library_release_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  reconciliation_status TEXT NOT NULL
    CHECK (reconciliation_status IN ('complete', 'partial', 'duplicate')),
  expected_track_count INTEGER NOT NULL CHECK (expected_track_count >= 0),
  matched_track_count INTEGER NOT NULL CHECK (matched_track_count >= 0),
  missing_track_count INTEGER NOT NULL CHECK (missing_track_count >= 0),
  matched_file_count INTEGER NOT NULL CHECK (matched_file_count >= 0),
  duplicate_track_count INTEGER NOT NULL CHECK (duplicate_track_count >= 0),
  evidence JSONB NULL,
  last_reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_release_id)
);

CREATE INDEX IF NOT EXISTS library_release_reconciliations_status_idx
  ON library_release_reconciliations (reconciliation_status, last_reconciled_at DESC);

CREATE INDEX IF NOT EXISTS library_release_reconciliations_artist_idx
  ON library_release_reconciliations (metadata_artist_id, metadata_release_group_id, last_reconciled_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000006',
  '20260430_000006_library_release_reconciliation_baseline.sql',
  'library_release_reconciliation_baseline',
  'cdd009c8ffb795b14edabe5e9323a511ce1b0ab6b82fe041d4320e5032dd14d2',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000007_metadata_artist_monitoring_baseline.sql
-- Checksum: 467768fbb751b54b2e2faddc1a12bf3e557267875298f4093219553420458d35
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

CREATE TABLE IF NOT EXISTS metadata_artist_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  is_monitored BOOLEAN NOT NULL DEFAULT FALSE,
  monitored_release_group_types TEXT[] NOT NULL DEFAULT ARRAY['album', 'ep']::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_artist_id)
);

CREATE INDEX IF NOT EXISTS metadata_artist_monitoring_monitored_idx
  ON metadata_artist_monitoring (is_monitored, updated_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000007',
  '20260430_000007_metadata_artist_monitoring_baseline.sql',
  'metadata_artist_monitoring_baseline',
  '467768fbb751b54b2e2faddc1a12bf3e557267875298f4093219553420458d35',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000008_library_wanted_release_baseline.sql
-- Checksum: 7834f58a8d960d557e469e56095860316b47057aa93ea5f3b0e021475d8607e3
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

CREATE TABLE IF NOT EXISTS library_wanted_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  wanted_status TEXT NOT NULL,
  expected_track_count INTEGER NOT NULL,
  matched_track_count INTEGER NOT NULL,
  missing_track_count INTEGER NOT NULL,
  release_date DATE NULL,
  release_status TEXT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_release_id),
  CONSTRAINT library_wanted_releases_status_check CHECK (wanted_status IN ('missing', 'partial')),
  CONSTRAINT library_wanted_releases_track_counts_check CHECK (
    expected_track_count >= 0
    AND matched_track_count >= 0
    AND missing_track_count >= 0
    AND matched_track_count <= expected_track_count
    AND missing_track_count <= expected_track_count
  )
);

CREATE INDEX IF NOT EXISTS library_wanted_releases_status_idx
  ON library_wanted_releases (wanted_status, last_reconciled_at DESC);

CREATE INDEX IF NOT EXISTS library_wanted_releases_artist_idx
  ON library_wanted_releases (metadata_artist_id, last_reconciled_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000008',
  '20260430_000008_library_wanted_release_baseline.sql',
  'library_wanted_release_baseline',
  '7834f58a8d960d557e469e56095860316b47057aa93ea5f3b0e021475d8607e3',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000009_library_discovery_request_baseline.sql
-- Checksum: 1f9d9b50b7434f7078d9c46e8dd872d1430dd1600327afa8e40c42f8348f6ee1
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

CREATE TABLE IF NOT EXISTS library_discovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  metadata_release_id UUID NOT NULL REFERENCES metadata_releases(id) ON DELETE CASCADE,
  wanted_status TEXT NOT NULL,
  search_mode TEXT NOT NULL DEFAULT 'automatic',
  request_status TEXT NOT NULL,
  blocked_reason TEXT NULL,
  release_date DATE NULL,
  last_search_at TIMESTAMPTZ NULL,
  next_search_after TIMESTAMPTZ NULL,
  manual_requested_at TIMESTAMPTZ NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metadata_release_id),
  CONSTRAINT library_discovery_requests_wanted_status_check CHECK (wanted_status IN ('missing', 'partial')),
  CONSTRAINT library_discovery_requests_search_mode_check CHECK (search_mode IN ('automatic', 'manual')),
  CONSTRAINT library_discovery_requests_status_check CHECK (request_status IN ('ready', 'cooldown', 'blocked'))
);

CREATE INDEX IF NOT EXISTS library_discovery_requests_status_idx
  ON library_discovery_requests (request_status, next_search_after ASC);

CREATE INDEX IF NOT EXISTS library_discovery_requests_artist_idx
  ON library_discovery_requests (metadata_artist_id, next_search_after ASC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000009',
  '20260430_000009_library_discovery_request_baseline.sql',
  'library_discovery_request_baseline',
  '1f9d9b50b7434f7078d9c46e8dd872d1430dd1600327afa8e40c42f8348f6ee1',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000010_import_execution_run_items.sql
-- Checksum: a596d76878e0e1aabad38b1f18f28719c350e57dfdbb21d755d1e0ee21313095
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

CREATE TABLE IF NOT EXISTS import_execution_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES operation_runs(id) ON DELETE CASCADE,
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  item_status TEXT NOT NULL
    CHECK (item_status IN ('ready', 'ready_with_warnings', 'blocked')),
  status_message TEXT NOT NULL,
  planning_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation_run_id, import_candidate_id),
  UNIQUE (operation_run_id, position)
);

CREATE INDEX IF NOT EXISTS import_execution_run_items_run_idx
  ON import_execution_run_items (operation_run_id, position ASC);

CREATE INDEX IF NOT EXISTS import_execution_run_items_candidate_idx
  ON import_execution_run_items (import_candidate_id, created_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000010',
  '20260430_000010_import_execution_run_items.sql',
  'import_execution_run_items',
  'a596d76878e0e1aabad38b1f18f28719c350e57dfdbb21d755d1e0ee21313095',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000011_import_execution_run_item_enqueue_status.sql
-- Checksum: e434dc1b9cd7021a2aa744c4335708e00fc615e3d22bced4f9065dbb0de48d75
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

ALTER TABLE import_execution_run_items
  DROP CONSTRAINT IF EXISTS import_execution_run_items_item_status_check;

ALTER TABLE import_execution_run_items
  ADD CONSTRAINT import_execution_run_items_item_status_check
  CHECK (item_status IN (
    'ready',
    'ready_with_warnings',
    'blocked',
    'queued',
    'queued_with_warnings',
    'queue_failed'
  ));

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000011',
  '20260430_000011_import_execution_run_item_enqueue_status.sql',
  'import_execution_run_item_enqueue_status',
  'e434dc1b9cd7021a2aa744c4335708e00fc615e3d22bced4f9065dbb0de48d75',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000012_import_candidate_execution_statuses.sql
-- Checksum: 3720a5c4f0b9d3738ceb9223219eaa5a5cb01ec7976a83cc4ebcc6291d7f69a9
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

ALTER TABLE import_candidates
  DROP CONSTRAINT IF EXISTS import_candidates_status_check;

ALTER TABLE import_candidates
  ADD CONSTRAINT import_candidates_status_check
  CHECK (status IN (
    'pending',
    'held',
    'rejected',
    'selected',
    'downloading',
    'import_pending',
    'applied',
    'failed'
  ));

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000012',
  '20260430_000012_import_candidate_execution_statuses.sql',
  'import_candidate_execution_statuses',
  '3720a5c4f0b9d3738ceb9223219eaa5a5cb01ec7976a83cc4ebcc6291d7f69a9',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000013_import_apply_run_items.sql
-- Checksum: 68169a4b625c244993594b13926d7c55c31a4045b91d4a90198311f3f37f1f62
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

CREATE TABLE IF NOT EXISTS import_apply_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES operation_runs(id) ON DELETE CASCADE,
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  item_status TEXT NOT NULL
    CHECK (item_status IN (
      'ready',
      'ready_with_warnings',
      'blocked',
      'applied',
      'applied_with_warnings',
      'apply_failed'
    )),
  status_message TEXT NOT NULL,
  apply_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation_run_id, import_candidate_id),
  UNIQUE (operation_run_id, position)
);

CREATE INDEX IF NOT EXISTS import_apply_run_items_run_idx
  ON import_apply_run_items (operation_run_id, position ASC);

CREATE INDEX IF NOT EXISTS import_apply_run_items_candidate_idx
  ON import_apply_run_items (import_candidate_id, created_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000013',
  '20260430_000013_import_apply_run_items.sql',
  'import_apply_run_items',
  '68169a4b625c244993594b13926d7c55c31a4045b91d4a90198311f3f37f1f62',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_000014_import_operations.sql
-- Checksum: 11127d8bd97959fb24883785975f5ea619d2402e2464bfb5f90a6e611e15fc27
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

CREATE TABLE IF NOT EXISTS import_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_run_id UUID NOT NULL REFERENCES operation_runs(id) ON DELETE CASCADE,
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  import_candidate_file_id UUID NOT NULL REFERENCES import_candidate_files(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  step_type TEXT NOT NULL
    CHECK (step_type IN ('stage', 'finalize')),
  operation_type TEXT NOT NULL
    CHECK (operation_type IN ('move', 'copy', 'hardlink')),
  transport TEXT NULL,
  source_path TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('applied', 'failed', 'not_attempted')),
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation_run_id, position),
  UNIQUE (operation_run_id, import_candidate_file_id, step_type)
);

CREATE INDEX IF NOT EXISTS import_operations_run_idx
  ON import_operations (operation_run_id, position ASC);

CREATE INDEX IF NOT EXISTS import_operations_candidate_file_idx
  ON import_operations (import_candidate_file_id, created_at DESC);

CREATE INDEX IF NOT EXISTS import_operations_candidate_idx
  ON import_operations (import_candidate_id, created_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_000014',
  '20260430_000014_import_operations.sql',
  'import_operations',
  '11127d8bd97959fb24883785975f5ea619d2402e2464bfb5f90a6e611e15fc27',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();

-- Migration: 20260430_235900_import_candidate_file_decisions.sql
-- Checksum: f8c9ce07258cbc2ff6f1a58f8dd2734c393cdbf48c8c550f6cfd0efeb77bda3c
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

CREATE TABLE IF NOT EXISTS import_candidate_file_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_candidate_id UUID NOT NULL REFERENCES import_candidates(id) ON DELETE CASCADE,
  import_candidate_file_id UUID NOT NULL REFERENCES import_candidate_files(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL
    CHECK (decision_type IN ('skip')),
  reason TEXT NULL,
  actor_user_id UUID NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_candidate_file_id)
);

CREATE INDEX IF NOT EXISTS import_candidate_file_decisions_candidate_idx
  ON import_candidate_file_decisions (import_candidate_id, updated_at DESC);

ALTER TABLE import_operations
  DROP CONSTRAINT IF EXISTS import_operations_status_check;

ALTER TABLE import_operations
  ADD CONSTRAINT import_operations_status_check
  CHECK (status IN ('applied', 'failed', 'not_attempted', 'skipped'));

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260430_235900',
  '20260430_235900_import_candidate_file_decisions.sql',
  'import_candidate_file_decisions',
  'f8c9ce07258cbc2ff6f1a58f8dd2734c393cdbf48c8c550f6cfd0efeb77bda3c',
  'applied'
)
ON CONFLICT (filename) DO UPDATE
SET migration_key = EXCLUDED.migration_key,
    description = EXCLUDED.description,
    checksum = EXCLUDED.checksum,
    status = EXCLUDED.status,
    started_at = NULL,
    finished_at = NULL,
    duration_ms = NULL,
    error_message = NULL,
    application_version = NULL,
    updated_at = NOW();
