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



CREATE OR REPLACE FUNCTION harmoniarr_generate_uuid()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  generated_id UUID;
BEGIN
  BEGIN
    EXECUTE 'SELECT uuidv7()' INTO generated_id;
    RETURN generated_id;
  EXCEPTION
    WHEN undefined_function THEN
      RETURN gen_random_uuid();
  END;
END;
$$;



CREATE TABLE IF NOT EXISTS schema_migrations (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
-- Checksum: 95b82591c7238e505291105dd7e1a01101b5309fa2319a67e0002422ea3982a8
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

CREATE OR REPLACE FUNCTION harmoniarr_generate_uuid()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  generated_id UUID;
BEGIN
  BEGIN
    EXECUTE 'SELECT uuidv7()' INTO generated_id;
    RETURN generated_id;
  EXCEPTION
    WHEN undefined_function THEN
      RETURN gen_random_uuid();
  END;
END;
$$;

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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  secret_type TEXT NOT NULL,
  name TEXT NOT NULL,
  encrypted_value BYTEA NOT NULL,
  encryption_key_version TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  namespace TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  updated_by_user_id UUID NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(namespace, setting_key)
);

CREATE TABLE IF NOT EXISTS maintenance_locks (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '95b82591c7238e505291105dd7e1a01101b5309fa2319a67e0002422ea3982a8',
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
-- Checksum: 326f4ef00fbd4a83b60b516eb1842e2fea215c9a13f89ffdef527fe2c86857a3
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '326f4ef00fbd4a83b60b516eb1842e2fea215c9a13f89ffdef527fe2c86857a3',
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
-- Checksum: d1f0fcd20797b4e293d82ef7439f24928cfeac81886c29b0cfdb69c872d9a120
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  'd1f0fcd20797b4e293d82ef7439f24928cfeac81886c29b0cfdb69c872d9a120',
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
-- Checksum: 476939ce1e119ac99ecf8372b0bff540be4f2404e770c2374099d7c6d96a165f
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '476939ce1e119ac99ecf8372b0bff540be4f2404e770c2374099d7c6d96a165f',
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
-- Checksum: 278e7982e84c5aba4ea38e3a85d9f793254592c9dad1ee70e0796bb57771dc89
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '278e7982e84c5aba4ea38e3a85d9f793254592c9dad1ee70e0796bb57771dc89',
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
-- Checksum: fe82fcc78bdb39da557ab90fccf822f9d65ba2a88f6a2bf124fbcdd9016aa729
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  'fe82fcc78bdb39da557ab90fccf822f9d65ba2a88f6a2bf124fbcdd9016aa729',
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
-- Checksum: 7d1a55201645035f935d97d27c78e28d719e2071c2dc0f04fdff040eb991ab35
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '7d1a55201645035f935d97d27c78e28d719e2071c2dc0f04fdff040eb991ab35',
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
-- Checksum: 378e68fce24d78d6b3d437d24bd00895a434969addb9644e8b4dc8c8285d4608
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '378e68fce24d78d6b3d437d24bd00895a434969addb9644e8b4dc8c8285d4608',
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
-- Checksum: 3f67acfe5628c27e3c06df00fda09844cd7ba738eec102b722391dfa086edd17
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '3f67acfe5628c27e3c06df00fda09844cd7ba738eec102b722391dfa086edd17',
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
-- Checksum: c1653440196884b45805760057d4ea9cecd69eed6881113b9345b0afbd0a9be2
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  'c1653440196884b45805760057d4ea9cecd69eed6881113b9345b0afbd0a9be2',
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
-- Checksum: 2209294b6cc559ca6d35cd4d23d2f5fb61320c1b41972138069db3385c4674f3
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '2209294b6cc559ca6d35cd4d23d2f5fb61320c1b41972138069db3385c4674f3',
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
-- Checksum: fa24f1db4a20988b23efae57fd9b14a14afadae8cbafd032ce15431504ba89ec
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  'fa24f1db4a20988b23efae57fd9b14a14afadae8cbafd032ce15431504ba89ec',
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
-- Checksum: fe6b48b6f64efeb4e199ec8d7e393d9bc5622d06b9c96853f2813ddda647f82c
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  'fe6b48b6f64efeb4e199ec8d7e393d9bc5622d06b9c96853f2813ddda647f82c',
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
-- Checksum: 24c76f2e1c79d01338a641462f174966ad6b9e36c79108dda5282977a65e661e
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '24c76f2e1c79d01338a641462f174966ad6b9e36c79108dda5282977a65e661e',
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
-- Checksum: 1a85f0781b7b3608b2d9590d87966652c74501f12e35acb42465fd4d63389d0d
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  '1a85f0781b7b3608b2d9590d87966652c74501f12e35acb42465fd4d63389d0d',
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
-- Checksum: dc48fdcd551db75647826d545533798794f9ded9c8e063400f29ab9a555e1079
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
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
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
  'dc48fdcd551db75647826d545533798794f9ded9c8e063400f29ab9a555e1079',
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

-- Migration: 20260501_000001_artwork_unassigned_retention.sql
-- Checksum: ec609b57caaca9b3f3f62c329c2935a39122d33926e3c25007cbde321026bc23
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

ALTER TABLE artwork_assets
  ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMPTZ NULL;

ALTER TABLE artwork_assets
  ALTER COLUMN unassigned_at SET DEFAULT NOW();

UPDATE artwork_assets AS assets
SET unassigned_at = CASE
      WHEN EXISTS (
        SELECT 1
        FROM artwork_assignments AS assignments
        WHERE assignments.artwork_asset_id = assets.id
      ) THEN NULL
      ELSE NOW()
    END
WHERE assets.unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS artwork_assets_unassigned_cleanup_idx
  ON artwork_assets (unassigned_at ASC, created_at ASC, id ASC)
  WHERE unassigned_at IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260501_000001',
  '20260501_000001_artwork_unassigned_retention.sql',
  'artwork_unassigned_retention',
  'ec609b57caaca9b3f3f62c329c2935a39122d33926e3c25007cbde321026bc23',
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

-- Migration: 20260501_000015_operation_run_cancellation.sql
-- Checksum: f97ee2bb3302e05e61ca7745c5da275585754dc632a61fc20569d0ec13bb798a
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

ALTER TABLE operation_runs
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cancel_requested_by_user_id UUID NULL REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260501_000015',
  '20260501_000015_operation_run_cancellation.sql',
  'operation_run_cancellation',
  'f97ee2bb3302e05e61ca7745c5da275585754dc632a61fc20569d0ec13bb798a',
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

-- Migration: 20260501_000016_operation_run_queue_retry.sql
-- Checksum: 9315764e757b31a77b8c94f27554e849e2286d9f0ebc74fdbcf8d5224504a63f
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

ALTER TABLE operation_runs
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS claimed_by_instance_id TEXT NULL;

CREATE INDEX IF NOT EXISTS operation_runs_pending_dispatch_idx
  ON operation_runs (next_attempt_at ASC, started_at ASC, created_at ASC)
  WHERE status = 'pending';

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260501_000016',
  '20260501_000016_operation_run_queue_retry.sql',
  'operation_run_queue_retry',
  '9315764e757b31a77b8c94f27554e849e2286d9f0ebc74fdbcf8d5224504a63f',
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

-- Migration: 20260501_000017_operation_run_recovery_index.sql
-- Checksum: 76fd7608ad35eb3ad5fb0b3b4f3cfa9f7e8ab04affe457d3ba2841f719452fc1
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

CREATE INDEX IF NOT EXISTS operation_runs_running_recovery_idx
  ON operation_runs (started_at ASC, created_at ASC)
  WHERE status = 'running';

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260501_000017',
  '20260501_000017_operation_run_recovery_index.sql',
  'operation_run_recovery_index',
  '76fd7608ad35eb3ad5fb0b3b4f3cfa9f7e8ab04affe457d3ba2841f719452fc1',
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

-- Migration: 20260501_000018_metadata_refresh_schedule.sql
-- Checksum: d7e05bd7d1041e5dce00c4ca71177e871ac6e599339f384e1b08b5f46e547e7b
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

ALTER TABLE metadata_artist_monitoring
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS next_refresh_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS metadata_artist_monitoring_due_refresh_idx
  ON metadata_artist_monitoring (is_monitored, next_refresh_at ASC, updated_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260501_000018',
  '20260501_000018_metadata_refresh_schedule.sql',
  'metadata_refresh_schedule',
  'd7e05bd7d1041e5dce00c4ca71177e871ac6e599339f384e1b08b5f46e547e7b',
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

-- Migration: 20260502_000001_metadata_release_detection_events.sql
-- Checksum: 44a73df113b905e149514770e6a93031b1e4042d0efbf31c1b73cce26629edcf
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

CREATE TABLE IF NOT EXISTS metadata_release_detection_events (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  metadata_artist_id UUID NOT NULL REFERENCES metadata_artists(id) ON DELETE CASCADE,
  metadata_release_group_id UUID NOT NULL REFERENCES metadata_release_groups(id) ON DELETE CASCADE,
  musicbrainz_release_group_id TEXT NULL,
  provider TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  detection_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  monitoring_decision TEXT NOT NULL,
  resulting_wanted_status TEXT NULL,
  title TEXT NOT NULL,
  primary_type TEXT NULL,
  first_release_date DATE NULL,
  operation_run_id UUID NULL REFERENCES operation_runs(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metadata_release_detection_events_artist_idx
  ON metadata_release_detection_events (metadata_artist_id, occurred_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS metadata_release_detection_events_run_idx
  ON metadata_release_detection_events (operation_run_id)
  WHERE operation_run_id IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000001',
  '20260502_000001_metadata_release_detection_events.sql',
  'metadata_release_detection_events',
  '44a73df113b905e149514770e6a93031b1e4042d0efbf31c1b73cce26629edcf',
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

-- Migration: 20260502_000002_metadata_release_detection_pagination_idx.sql
-- Checksum: 08fda81c1a583e855fc73add99bb648cd6143ad9d0e4996ff6b87b6409a3e714
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

CREATE INDEX IF NOT EXISTS metadata_release_detection_events_artist_page_idx
  ON metadata_release_detection_events (metadata_artist_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS metadata_release_detection_events_occurred_idx
  ON metadata_release_detection_events (occurred_at ASC, id ASC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000002',
  '20260502_000002_metadata_release_detection_pagination_idx.sql',
  'metadata_release_detection_pagination_idx',
  '08fda81c1a583e855fc73add99bb648cd6143ad9d0e4996ff6b87b6409a3e714',
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

-- Migration: 20260502_000003_app_user_provisioning_baseline.sql
-- Checksum: c45b4f1d4f56b4711198570bb2a62381a4b8065ba27f2016568455069ae9b283
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

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS auth_subject TEXT NULL,
  ADD COLUMN IF NOT EXISTS managed_library_relative_root TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_auth_provider_subject_unique
  ON app_users (auth_provider, auth_subject)
  WHERE auth_subject IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000003',
  '20260502_000003_app_user_provisioning_baseline.sql',
  'app_user_provisioning_baseline',
  'c45b4f1d4f56b4711198570bb2a62381a4b8065ba27f2016568455069ae9b283',
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

-- Migration: 20260502_000004_app_user_managed_library_root_uniqueness.sql
-- Checksum: c53cbdf55cae8cf9b208b4acfd7840fdd221b67f9986c501b0f3505c28769b46
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

CREATE UNIQUE INDEX IF NOT EXISTS app_users_managed_library_relative_root_unique
  ON app_users (managed_library_relative_root)
  WHERE managed_library_relative_root IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000004',
  '20260502_000004_app_user_managed_library_root_uniqueness.sql',
  'app_user_managed_library_root_uniqueness',
  'c53cbdf55cae8cf9b208b4acfd7840fdd221b67f9986c501b0f3505c28769b46',
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

-- Migration: 20260502_000005_media_request_intake.sql
-- Checksum: 489ca83c79810098d8117d4672c85f02dd1d7985376ff5eac076435f119c769e
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

CREATE TABLE IF NOT EXISTS media_requests (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  requested_by_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  request_kind TEXT NOT NULL,
  request_state TEXT NOT NULL,
  artist_name TEXT NULL,
  release_title TEXT NULL,
  track_title TEXT NULL,
  source_url TEXT NULL,
  source_provider TEXT NULL,
  normalized_query TEXT NOT NULL,
  matched_metadata_release_group_id UUID NULL REFERENCES metadata_release_groups(id) ON DELETE SET NULL,
  matched_metadata_release_id UUID NULL REFERENCES metadata_releases(id) ON DELETE SET NULL,
  notes TEXT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_requests_kind_check CHECK (request_kind IN ('release', 'track', 'external_url')),
  CONSTRAINT media_requests_state_check CHECK (request_state IN ('already_exists', 'needs_fetch', 'needs_review')),
  CONSTRAINT media_requests_payload_check CHECK (
    (request_kind = 'release' AND artist_name IS NOT NULL AND release_title IS NOT NULL AND track_title IS NULL)
    OR (request_kind = 'track' AND artist_name IS NOT NULL AND track_title IS NOT NULL)
    OR (request_kind = 'external_url' AND source_url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS media_requests_requested_by_user_created_at_idx
  ON media_requests (requested_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_requests_state_created_at_idx
  ON media_requests (request_state, created_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000005',
  '20260502_000005_media_request_intake.sql',
  'media_request_intake',
  '489ca83c79810098d8117d4672c85f02dd1d7985376ff5eac076435f119c769e',
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

-- Migration: 20260502_000006_uuid_surrogate_key_policy.sql
-- Checksum: 984daae6e682307349e8cb5cc2d92af994733dc3cdd98505cac52cd946849e43
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

CREATE OR REPLACE FUNCTION harmoniarr_generate_uuid()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  generated_id UUID;
BEGIN
  BEGIN
    EXECUTE 'SELECT uuidv7()' INTO generated_id;
    RETURN generated_id;
  EXCEPTION
    WHEN undefined_function THEN
      RETURN gen_random_uuid();
  END;
END;
$$;

ALTER TABLE IF EXISTS schema_migrations ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS app_users ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS refresh_tokens ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS api_keys ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS encrypted_secrets ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS audit_events ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS app_settings ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS maintenance_locks ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS admin_recovery_runs ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS operation_runs ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS job_leases ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS artwork_assets ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS artwork_assignments ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_artists ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_artist_aliases ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_release_groups ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_releases ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_media ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_recordings ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_tracks ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_provider_snapshots ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS import_candidates ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS import_candidate_files ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS import_candidate_events ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS library_roots ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS library_files ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS file_tag_snapshots ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS library_file_matches ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS library_release_reconciliations ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_artist_monitoring ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS library_wanted_releases ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS library_discovery_requests ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS import_execution_run_items ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS import_apply_run_items ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS import_operations ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS import_candidate_file_decisions ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS metadata_release_detection_events ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();
ALTER TABLE IF EXISTS media_requests ALTER COLUMN id SET DEFAULT harmoniarr_generate_uuid();

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000006',
  '20260502_000006_uuid_surrogate_key_policy.sql',
  'uuid_surrogate_key_policy',
  '984daae6e682307349e8cb5cc2d92af994733dc3cdd98505cac52cd946849e43',
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

-- Migration: 20260502_000007_import_candidate_file_lossy_derivative_decision.sql
-- Checksum: 4999a966c3db6ff6b3392fbb834a0388150fd779527fa6d88518238fdc07c8bd
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

ALTER TABLE import_candidate_file_decisions
  DROP CONSTRAINT IF EXISTS import_candidate_file_decisions_decision_type_check;

ALTER TABLE import_candidate_file_decisions
  ADD CONSTRAINT import_candidate_file_decisions_decision_type_check
  CHECK (decision_type IN ('skip', 'allow_lossy_derivative'));

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000007',
  '20260502_000007_import_candidate_file_lossy_derivative_decision.sql',
  'import_candidate_file_lossy_derivative_decision',
  '4999a966c3db6ff6b3392fbb834a0388150fd779527fa6d88518238fdc07c8bd',
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

-- Migration: 20260502_000008_backup_artifact_metadata.sql
-- Checksum: c6c1af6ea42f9bb87fe9093b4337b18bcb9f2b1b8cb21d169156213e70af8a3d
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

CREATE TABLE IF NOT EXISTS backup_artifacts (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  filename TEXT NOT NULL UNIQUE,
  backup_type TEXT NOT NULL,
  encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  format_version TEXT NOT NULL,
  app_version TEXT NULL,
  migration_level TEXT NULL,
  scope_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload_sha256 TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  created_by_user_id UUID NULL REFERENCES app_users(id),
  storage_path TEXT NOT NULL,
  manifest_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_artifacts_created_at
  ON backup_artifacts (created_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000008',
  '20260502_000008_backup_artifact_metadata.sql',
  'backup_artifact_metadata',
  'c6c1af6ea42f9bb87fe9093b4337b18bcb9f2b1b8cb21d169156213e70af8a3d',
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

-- Migration: 20260502_000009_recovery_scope_runtime_snapshots.sql
-- Checksum: 497564769ddd5b63d16a66d2ad1cdf608e37d725bf86cd3df08179d6ca218f71
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

CREATE TABLE IF NOT EXISTS recovery_trust_snapshots (
  snapshot_order INTEGER PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (snapshot_order >= 0)
);

CREATE TABLE IF NOT EXISTS recovery_override_snapshots (
  snapshot_order INTEGER PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (snapshot_order >= 0)
);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000009',
  '20260502_000009_recovery_scope_runtime_snapshots.sql',
  'recovery_scope_runtime_snapshots',
  '497564769ddd5b63d16a66d2ad1cdf608e37d725bf86cd3df08179d6ca218f71',
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

-- Migration: 20260502_000010_control_plane_idempotency_records.sql
-- Checksum: 0704567e9201159fccf18b2f2fb5a8480d912c7ff2c46b25238e530201112506
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

CREATE TABLE IF NOT EXISTS control_plane_idempotency_records (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  operation_scope TEXT NOT NULL,
  actor_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NULL,
  UNIQUE (operation_scope, actor_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_control_plane_idempotency_records_expires_at
  ON control_plane_idempotency_records (expires_at);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000010',
  '20260502_000010_control_plane_idempotency_records.sql',
  'control_plane_idempotency_records',
  '0704567e9201159fccf18b2f2fb5a8480d912c7ff2c46b25238e530201112506',
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

-- Migration: 20260502_000011_provider_ingest_request_intents.sql
-- Checksum: a48e97c2581eae43db5d8deeca1f97d9f823adb3bdef4bae0bb2b9ccb64b2896
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

CREATE TABLE IF NOT EXISTS provider_ingest_requests (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  media_request_id UUID NOT NULL REFERENCES media_requests(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_resource_type TEXT NOT NULL,
  ingest_target_type TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1 CHECK (page_number > 0),
  page_cursor TEXT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT provider_ingest_requests_source_provider_check CHECK (source_provider IN ('spotify', 'youtube', 'apple_music')),
  CONSTRAINT provider_ingest_requests_source_resource_type_check CHECK (source_resource_type IN ('playlist', 'artist', 'release', 'track', 'video')),
  CONSTRAINT provider_ingest_requests_ingest_target_type_check CHECK (ingest_target_type IN ('playlist_page', 'artist', 'release', 'track', 'video')),
  CONSTRAINT provider_ingest_requests_status_check CHECK (status IN ('planned', 'processing', 'completed', 'failed', 'unsupported'))
);

CREATE INDEX IF NOT EXISTS provider_ingest_requests_media_request_idx
  ON provider_ingest_requests (media_request_id, created_at ASC);

CREATE INDEX IF NOT EXISTS provider_ingest_requests_status_idx
  ON provider_ingest_requests (status, source_provider, created_at ASC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260502_000011',
  '20260502_000011_provider_ingest_request_intents.sql',
  'provider_ingest_request_intents',
  'a48e97c2581eae43db5d8deeca1f97d9f823adb3bdef4bae0bb2b9ccb64b2896',
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

-- Migration: 20260503_002533_backup_artifact_encryption_key_fingerprint.sql
-- Checksum: 49d44711a4080a9183601b901f0be254007dc3402145c623cdb7ace0352f5798
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

BEGIN;

ALTER TABLE backup_artifacts
  ADD COLUMN IF NOT EXISTS encryption_key_fingerprint TEXT NULL;

COMMIT;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260503_002533',
  '20260503_002533_backup_artifact_encryption_key_fingerprint.sql',
  'backup_artifact_encryption_key_fingerprint',
  '49d44711a4080a9183601b901f0be254007dc3402145c623cdb7ace0352f5798',
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

-- Migration: 20260503_003100_admin_recovery_runs.sql
-- Checksum: 66f6aea47a255adde65534301fcb5f20cdfa0b1cd95dd44f6cdfbae4cee545f7
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

-- Admin recovery runs for emergency bootstrap-admin recovery

CREATE TABLE IF NOT EXISTS admin_recovery_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'armed'
    CHECK (status IN ('armed', 'completed', 'cancelled', 'expired', 'invalidated')),
  recovery_code_hash TEXT NOT NULL,
  armed_via TEXT NOT NULL DEFAULT 'harmoniarrctl',
  armed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  invalid_attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_admin_user_id TEXT REFERENCES app_users(id),
  completed_from_ip TEXT,
  completed_user_agent TEXT,
  reason TEXT,
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_recovery_runs_active
  ON admin_recovery_runs (status, expires_at)
  WHERE status = 'armed';

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260503_003100',
  '20260503_003100_admin_recovery_runs.sql',
  'admin_recovery_runs',
  '66f6aea47a255adde65534301fcb5f20cdfa0b1cd95dd44f6cdfbae4cee545f7',
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

-- Migration: 20260503_010000_app_user_email_identity.sql
-- Checksum: 6ecedfafdca719d80c2a69155cc125bca932580546e58de96e664510e1c61995
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

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS email TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique
  ON app_users (lower(email))
  WHERE email IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260503_010000',
  '20260503_010000_app_user_email_identity.sql',
  'app_user_email_identity',
  '6ecedfafdca719d80c2a69155cc125bca932580546e58de96e664510e1c61995',
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

-- Migration: 20260503_020000_app_user_plex_profiles.sql
-- Checksum: 091423cdc018dca6a769d3c262b302714619fac5598fc1be81693dde0de3767e
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

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260503_020000',
  '20260503_020000_app_user_plex_profiles.sql',
  'app_user_plex_profiles',
  '091423cdc018dca6a769d3c262b302714619fac5598fc1be81693dde0de3767e',
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

-- Migration: 20260504_010000_app_user_claim_codes.sql
-- Checksum: 8660cf964db827de1dacf07f8d3bad73c393f32719f70355415a65a382102cf7
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

CREATE TABLE IF NOT EXISTS app_user_claim_codes (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  issued_by_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  claim_code_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoke_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS app_user_claim_codes_active_user_idx
  ON app_user_claim_codes (app_user_id, created_at DESC)
  WHERE consumed_at IS NULL
    AND revoked_at IS NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260504_010000',
  '20260504_010000_app_user_claim_codes.sql',
  'app_user_claim_codes',
  '8660cf964db827de1dacf07f8d3bad73c393f32719f70355415a65a382102cf7',
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

-- Migration: 20260504_020000_media_request_target_user.sql
-- Checksum: d3f276003fb63461f81f2761071b75e664ef46bb9cf6999b6285c3d78c71fab7
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

ALTER TABLE media_requests
  ADD COLUMN IF NOT EXISTS requested_for_user_id UUID NULL REFERENCES app_users(id) ON DELETE CASCADE;

UPDATE media_requests
SET requested_for_user_id = requested_by_user_id
WHERE requested_for_user_id IS NULL;

ALTER TABLE media_requests
  ALTER COLUMN requested_for_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS media_requests_requested_for_user_created_at_idx
  ON media_requests (requested_for_user_id, created_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260504_020000',
  '20260504_020000_media_request_target_user.sql',
  'media_request_target_user',
  'd3f276003fb63461f81f2761071b75e664ef46bb9cf6999b6285c3d78c71fab7',
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

-- Migration: 20260504_030000_admin_recovery_schema_compat.sql
-- Checksum: 8ced5f2e7662c2a04e99c456bf6a7b2e5089a041a91423c287f3f3b7443779bd
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

ALTER TABLE IF EXISTS admin_recovery_runs
  ADD COLUMN IF NOT EXISTS reason TEXT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_recovery_runs'
      AND column_name = 'details'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_recovery_runs'
      AND column_name = 'details_json'
  ) THEN
    EXECUTE 'ALTER TABLE admin_recovery_runs RENAME COLUMN details TO details_json';
  END IF;
END $$;

ALTER TABLE IF EXISTS admin_recovery_runs
  ADD COLUMN IF NOT EXISTS details_json JSONB NULL;

ALTER TABLE IF EXISTS admin_recovery_runs
  ALTER COLUMN status SET DEFAULT 'armed',
  ALTER COLUMN armed_via SET DEFAULT 'harmoniarrctl',
  ALTER COLUMN armed_at SET DEFAULT NOW();

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260504_030000',
  '20260504_030000_admin_recovery_schema_compat.sql',
  'admin_recovery_schema_compat',
  '8ced5f2e7662c2a04e99c456bf6a7b2e5089a041a91423c287f3f3b7443779bd',
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

-- Migration: 20260505_010000_drop_user_maintenance_locks.sql
-- Checksum: 71bbdbdf1255359873e461d56021576462fbbe737c42489ed0b2922a8cc61335
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

-- Remove user-managed maintenance locks. The 'maintenance' lock type was used
-- exclusively by the user-facing "Safety holds" UI panel, which has been
-- removed. System-generated locks (restore, upgrade, admin_recovery) continue
-- to use this table and are unaffected.
DELETE FROM maintenance_locks WHERE lock_type = 'maintenance';

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260505_010000',
  '20260505_010000_drop_user_maintenance_locks.sql',
  'drop_user_maintenance_locks',
  '71bbdbdf1255359873e461d56021576462fbbe737c42489ed0b2922a8cc61335',
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

-- Migration: 20260506_010000_add_artwork_dominant_color.sql
-- Checksum: 6b5a158a215132d39392582d13b2002a69b1b69b03de5ec230b78fdc147fa617
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

-- Add dominant OKLCH color components to artwork_assets for theme-adaptive card accents.
--
-- dominant_hue / dominant_chroma: extracted at ingest time via sharp.stats() histogram.
-- dominant_lightness: reference only — card CSS derives theme-appropriate L at render time
--   (0.72 dark, 0.38 light) so the border is always legible regardless of artwork origin.
-- dominant_hex: STORED generated column for API compatibility. Computed by oklch_to_hex().
--
-- A vibrancy gate (C >= 0.05) at ingest time ensures near-grey artwork leaves all four
-- columns NULL rather than storing achromatic values that produce no visible accent.
--
-- No backfill is required. Pre-migration assets receive values via client-side worker
-- write-back (PATCH /api/v1/artwork/assets/:id/dominant-color, WHERE dominant_hue IS NULL)
-- on first Library view load. After first write-back the worker never fires for that asset.

-- OKLCH → linear sRGB → gamma-compressed sRGB → 6-character hex string.
-- IMMUTABLE STRICT: output depends only on inputs; returns NULL when any input is NULL.
-- PARALLEL SAFE: no shared state.
-- Used by the dominant_hex generated column below.
CREATE OR REPLACE FUNCTION oklch_to_hex(l_in NUMERIC, c_in NUMERIC, h_in NUMERIC)
RETURNS VARCHAR(7)
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  WITH
  -- Step 1: OKLCH → Oklab (a, b components from hue angle and chroma)
  ab AS (
    SELECT
      (c_in * cos(radians(h_in::double precision)))::numeric AS a_ok,
      (c_in * sin(radians(h_in::double precision)))::numeric AS b_ok
  ),
  -- Step 2: Oklab → LMS cube-roots (the Björn Ottosson M1 matrix, inverted)
  lms_prime AS (
    SELECT
      l_in + 0.3963377774 * ab.a_ok + 0.2158037573 * ab.b_ok AS lp,
      l_in - 0.1055613458 * ab.a_ok - 0.0638541728 * ab.b_ok AS mp,
      l_in - 0.0894841775 * ab.a_ok - 1.2914855480 * ab.b_ok AS sp
    FROM ab
  ),
  -- Step 3: cube-root → cube to recover linear LMS
  lms AS (
    SELECT lp ^ 3 AS l, mp ^ 3 AS m, sp ^ 3 AS s FROM lms_prime
  ),
  -- Step 4: linear LMS → linear sRGB (Ottosson M2 matrix), clamped to [0, 1]
  lin AS (
    SELECT
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        ( 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)::double precision)) AS r,
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        (-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)::double precision)) AS g,
      GREATEST(0.0::double precision, LEAST(1.0::double precision,
        (-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)::double precision)) AS b
    FROM lms
  ),
  -- Step 5: linear sRGB → gamma-compressed sRGB (IEC 61966-2-1 transfer function)
  srgb AS (
    SELECT
      CASE WHEN r <= 0.0031308 THEN 12.92 * r ELSE 1.055 * r ^ (1.0 / 2.4) - 0.055 END AS r8,
      CASE WHEN g <= 0.0031308 THEN 12.92 * g ELSE 1.055 * g ^ (1.0 / 2.4) - 0.055 END AS g8,
      CASE WHEN b <= 0.0031308 THEN 12.92 * b ELSE 1.055 * b ^ (1.0 / 2.4) - 0.055 END AS b8
    FROM lin
  )
  -- Step 6: scale to [0, 255], round, format as lowercase hex with leading-zero padding
  SELECT
    '#' ||
    LPAD(TO_HEX(ROUND(r8 * 255)::integer), 2, '0') ||
    LPAD(TO_HEX(ROUND(g8 * 255)::integer), 2, '0') ||
    LPAD(TO_HEX(ROUND(b8 * 255)::integer), 2, '0')
  FROM srgb
$$;

-- Three nullable OKLCH component columns.
-- dominant_lightness stored as reference; CSS uses fixed theme-appropriate L values.
ALTER TABLE artwork_assets
  ADD COLUMN IF NOT EXISTS dominant_hue       NUMERIC(6,2) NULL, -- degrees 0–360
  ADD COLUMN IF NOT EXISTS dominant_chroma    NUMERIC(6,4) NULL, -- OKLCH C, approx 0.0–0.4
  ADD COLUMN IF NOT EXISTS dominant_lightness NUMERIC(6,4) NULL; -- OKLCH L, 0.0–1.0 (reference)

-- Generated backward-compatibility column so existing API consumers reading dominant_hex
-- continue to work without changes during the migration period.
ALTER TABLE artwork_assets
  ADD COLUMN IF NOT EXISTS dominant_hex VARCHAR(7)
    GENERATED ALWAYS AS (oklch_to_hex(dominant_lightness, dominant_chroma, dominant_hue)) STORED;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260506_010000',
  '20260506_010000_add_artwork_dominant_color.sql',
  'add_artwork_dominant_color',
  '6b5a158a215132d39392582d13b2002a69b1b69b03de5ec230b78fdc147fa617',
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

-- Migration: 20260509_133313_create_push_notification_tables.sql
-- Checksum: 023c94c49f9d74a05557b2e404af0892a79f8d54a4643a68effaf912c0aa6b3a
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

-- Push subscription registry — one row per browser/device registration.
-- Soft-deleted on 410/412 (invalidated_at set, never hard-deleted immediately).
-- Pruned after 30 days via a background maintenance task.
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  user_id         UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint        TEXT        NOT NULL UNIQUE,
  p256dh          TEXT        NOT NULL,
  auth            TEXT        NOT NULL,
  user_agent      TEXT        NULL,
  invalidated_at  TIMESTAMPTZ NULL,   -- set on 410/412; NULL means active
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active-subscription lookup: used by the notification dispatch path.
CREATE INDEX IF NOT EXISTS user_push_subscriptions_active_idx
  ON user_push_subscriptions (user_id, invalidated_at)
  WHERE invalidated_at IS NULL;

-- Async notification delivery queue — decouples event emitters from webpush I/O.
-- Background worker polls pending rows and calls webpush.sendNotification().
CREATE TABLE IF NOT EXISTS notification_queue (
  id               UUID        PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  user_id          UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  subscription_id  UUID        NULL REFERENCES user_push_subscriptions(id) ON DELETE CASCADE,
  event_type       TEXT        NOT NULL,
  coalesce_key     TEXT        NULL,   -- groups related events within the 2-min coalesce window
  payload          JSONB       NOT NULL,
  ttl_seconds      INTEGER     NOT NULL CHECK (ttl_seconds > 0),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'sent', 'failed', 'expired')),
  attempts         INTEGER     NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at          TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary worker polling index: pending rows ordered by delivery time.
CREATE INDEX IF NOT EXISTS notification_queue_pending_delivery_idx
  ON notification_queue (next_attempt_at ASC)
  WHERE status = 'pending';

-- Coalescing check: find an unprocessed row matching the same (user, type, coalesce_key)
-- within the last 2 minutes to determine whether to insert or update.
CREATE INDEX IF NOT EXISTS notification_queue_coalesce_lookup_idx
  ON notification_queue (user_id, event_type, coalesce_key, created_at DESC)
  WHERE status = 'pending' AND coalesce_key IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260509_133313',
  '20260509_133313_create_push_notification_tables.sql',
  'create_push_notification_tables',
  '023c94c49f9d74a05557b2e404af0892a79f8d54a4643a68effaf912c0aa6b3a',
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

-- Migration: 20260522_010000_create_fulfillment_evidence.sql
-- Checksum: 6cf47cd87c217b7205cd349af9cded1cd86d2f7c6b74e8ba7a900d69823b4852
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

-- Supplemental fulfillment evidence from external sources (e.g. Plex webhooks).
-- Each row is an immutable evidence record that can be correlated to Harmoniarr's
-- canonical workflow state (activity events, release records) to enrich fulfillment
-- visibility without making the external source authoritative.
--
-- Plex is NOT the source of truth. Harmoniarr's own workflow state remains canonical.
-- Evidence records are informational and diagnostic only.
CREATE TABLE IF NOT EXISTS fulfillment_evidence (
  id                         UUID         PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  source_type                TEXT         NOT NULL DEFAULT 'plex_webhook'
                                          CHECK (source_type IN ('plex_webhook')),
  source_event               TEXT         NOT NULL,
  source_server_uuid         TEXT         NULL,
  correlation_key            TEXT         NOT NULL,
  metadata_title             TEXT         NULL,
  metadata_artist            TEXT         NULL,
  metadata_album             TEXT         NULL,
  metadata_type              TEXT         NULL,
  raw_payload                JSONB        NULL,
  matched_activity_event_id  UUID         NULL,
  matched_at                 TIMESTAMPTZ  NULL,
  received_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at                 TIMESTAMPTZ  NOT NULL
);

-- Correlation lookup: find unmatched evidence by key for correlation.
CREATE INDEX IF NOT EXISTS fulfillment_evidence_unmatched_key_idx
  ON fulfillment_evidence (correlation_key, received_at DESC)
  WHERE matched_activity_event_id IS NULL;

-- Activity event match lookup: find evidence correlated to a specific event.
CREATE INDEX IF NOT EXISTS fulfillment_evidence_matched_event_idx
  ON fulfillment_evidence (matched_activity_event_id)
  WHERE matched_activity_event_id IS NOT NULL;

-- Retention cleanup: find expired evidence rows.
CREATE INDEX IF NOT EXISTS fulfillment_evidence_expires_at_idx
  ON fulfillment_evidence (expires_at)
  WHERE matched_at IS NULL;

-- Source event filtering for diagnostics.
CREATE INDEX IF NOT EXISTS fulfillment_evidence_source_event_received_idx
  ON fulfillment_evidence (source_event, received_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260522_010000',
  '20260522_010000_create_fulfillment_evidence.sql',
  'create_fulfillment_evidence',
  '6cf47cd87c217b7205cd349af9cded1cd86d2f7c6b74e8ba7a900d69823b4852',
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

-- Migration: 20260522_020000_media_request_fan_out.sql
-- Checksum: 946c95ebe7c0e5929e1718f2c48a9e09cac8e87728624cce8bdb8184c9eeef5f
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

-- Add fan-out columns so a single admin request can materialise
-- durable target-owned request rows for multiple users.
ALTER TABLE media_requests
  ADD COLUMN fan_out_parent_id UUID NULL
    REFERENCES media_requests(id) ON DELETE CASCADE,
  ADD COLUMN fan_out_child_count INTEGER NOT NULL DEFAULT 0;

-- Index for looking up children of a parent request.
CREATE INDEX idx_media_requests_fan_out_parent_id
  ON media_requests (fan_out_parent_id)
  WHERE fan_out_parent_id IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260522_020000',
  '20260522_020000_media_request_fan_out.sql',
  'media_request_fan_out',
  '946c95ebe7c0e5929e1718f2c48a9e09cac8e87728624cce8bdb8184c9eeef5f',
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

-- Migration: 20260522_030000_media_request_events.sql
-- Checksum: babc0f3ec045c9278725a279f255d318712692d9735b9a2a409562811631ca79
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

-- Append-only domain events for media request lifecycle tracking.
-- Follows the import_candidate_events pattern for consistency.
CREATE TABLE IF NOT EXISTS media_request_events (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  media_request_id UUID NOT NULL REFERENCES media_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_requested_for_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  new_requested_for_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  reason TEXT NULL,
  actor_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  details JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_request_events_request_id
  ON media_request_events (media_request_id, occurred_at DESC);

CREATE INDEX idx_media_request_events_event_type
  ON media_request_events (event_type)
  WHERE event_type = 'reassigned';

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260522_030000',
  '20260522_030000_media_request_events.sql',
  'media_request_events',
  'babc0f3ec045c9278725a279f255d318712692d9735b9a2a409562811631ca79',
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

-- Migration: 20260601_070000_add_canonical_to_metadata_releases.sql
-- Checksum: 3cdb7a9ff0a5d86e1a08cb42158aee161e5419fa264057a6e41b9cdf39e47f35
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

-- Add is_canonical flag to metadata_releases.
--
-- At most one release per release group may have is_canonical = TRUE. This is
-- enforced by a partial unique index so the constraint is only applied to the
-- true value, leaving all other releases defaulting to FALSE without conflict.
--
-- The canonical release is selected by backfillCanonicalReleases() at startup
-- and can be overridden by the PATCH /api/v1/metadata/releases/:id/canonical
-- endpoint. The tracklist endpoint uses the canonical release as the default
-- edition when no preference is specified.

ALTER TABLE metadata_releases
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS metadata_releases_one_canonical_per_group_idx
  ON metadata_releases (metadata_release_group_id)
  WHERE is_canonical = TRUE;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260601_070000',
  '20260601_070000_add_canonical_to_metadata_releases.sql',
  'add_canonical_to_metadata_releases',
  '3cdb7a9ff0a5d86e1a08cb42158aee161e5419fa264057a6e41b9cdf39e47f35',
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

-- Migration: 20260601_100000_create_activity_events.sql
-- Checksum: fb171af77d64d95248ca3eaa961d7b06763917211805a7533353d23d136c7186
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

-- Append-only household activity log. Never updated; only inserted and (eventually)
-- pruned by a background task after a configurable retention window (default: 90 days).
--
-- Each row captures a single user-visible household event: a music request being
-- submitted, an artist being monitored, a download completing, etc. The feed endpoint
-- reads from this table to serve the household activity stream.
--
-- actor_user_id is nullable (ON DELETE SET NULL) so events survive user deletion.
-- entity_* columns are denormalized for display; they survive entity deletion.
CREATE TABLE IF NOT EXISTS activity_events (
  id               UUID         PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  event_type       TEXT         NOT NULL
                   CHECK (event_type IN (
                     'request_created',
                     'download_completed',
                     'release_added',
                     'artist_monitored',
                     'request_fulfilled'
                   )),
  actor_user_id    UUID         NULL REFERENCES app_users(id) ON DELETE SET NULL,
  entity_type      TEXT         NULL,   -- 'release', 'artist', 'media_request'
  entity_id        UUID         NULL,   -- FK to the entity; not enforced at DB level (polymorphic)
  entity_title     TEXT         NULL,   -- denormalized display name; survives entity deletion
  entity_artist    TEXT         NULL,   -- denormalized artist name for release events
  extra_payload    JSONB        NULL,   -- event-specific supplemental data
  occurred_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Primary feed read: most recent N events, optionally filtered by event_type.
CREATE INDEX IF NOT EXISTS activity_events_occurred_at_desc_idx
  ON activity_events (occurred_at DESC);

-- Per-user filtering on the operator Activity view.
CREATE INDEX IF NOT EXISTS activity_events_actor_occurred_at_idx
  ON activity_events (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

-- Event-type filtering with date range.
CREATE INDEX IF NOT EXISTS activity_events_type_occurred_at_idx
  ON activity_events (event_type, occurred_at DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260601_100000',
  '20260601_100000_create_activity_events.sql',
  'create_activity_events',
  'fb171af77d64d95248ca3eaa961d7b06763917211805a7533353d23d136c7186',
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

-- Migration: 20260602_010000_create_push_subscriptions.sql
-- Checksum: 5aabea0e5a4037bc6edbffe6bf869643a851a4c87a646a8c09ca081b72e0d83f
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

-- Web Push subscription store. Each row represents a single browser or device
-- that has granted push permission and provided a PushSubscription object.
--
-- A user may have multiple active subscriptions (different browsers/devices).
-- The (user_id, endpoint) pair is unique so that re-subscribing from the same
-- browser/device is idempotent via upsert.
--
-- When the push service returns 404 or 410 for an endpoint the server removes
-- that row automatically ("auto-cleanup on expired subscription").
--
-- user_id is nullable on delete set null so orphan rows can be detected and
-- pruned rather than silently lost on user deletion.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID          PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  user_id      UUID          REFERENCES app_users(id) ON DELETE SET NULL,
  endpoint     TEXT          NOT NULL,
  p256dh       TEXT          NOT NULL,
  auth         TEXT          NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON push_subscriptions (user_id)
  WHERE user_id IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260602_010000',
  '20260602_010000_create_push_subscriptions.sql',
  'create_push_subscriptions',
  '5aabea0e5a4037bc6edbffe6bf869643a851a4c87a646a8c09ca081b72e0d83f',
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

-- Migration: 20260603_010000_add_user_preferences.sql
-- Checksum: a294222a4313f908a02096b0ecef78f460f32298a596f89748b0fa137b36ab9d
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

-- Add user_preferences JSONB column to app_users.
-- Stores per-user format and quality preferences used during import candidate
-- evaluation and download result scoring.
--
-- Default: empty object.  Application layer normalises missing keys to 'any'.

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS user_preferences JSONB NOT NULL DEFAULT '{}';

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260603_010000',
  '20260603_010000_add_user_preferences.sql',
  'add_user_preferences',
  'a294222a4313f908a02096b0ecef78f460f32298a596f89748b0fa137b36ab9d',
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

-- Migration: 20260604_010000_media_request_cross_user_dedup.sql
-- Checksum: f757afdcda6ea82eb1604adc3efc1d15a7af759bbf3cd9dc9d78412bf81ab411
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

-- Cross-user deduplication: link duplicate requests for the same release to a
-- single download job. musicbrainz_release_id enables exact MBID-based matching
-- without JOINing to metadata_releases. linked_request_id points to the primary
-- (first) request for this release; the linked request shares the same download.

ALTER TABLE media_requests
  ADD COLUMN IF NOT EXISTS musicbrainz_release_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS linked_request_id      UUID NULL REFERENCES media_requests(id) ON DELETE SET NULL;

-- Supports exact dedup lookup by MusicBrainz release MBID.
CREATE INDEX IF NOT EXISTS media_requests_musicbrainz_release_id_idx
  ON media_requests (musicbrainz_release_id)
  WHERE musicbrainz_release_id IS NOT NULL;

-- Prevents the same user from being linked to the same primary request twice
-- (rapid double-submit guard).
CREATE UNIQUE INDEX IF NOT EXISTS uq_media_requests_linked_per_user
  ON media_requests (linked_request_id, requested_for_user_id)
  WHERE linked_request_id IS NOT NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260604_010000',
  '20260604_010000_media_request_cross_user_dedup.sql',
  'media_request_cross_user_dedup',
  'f757afdcda6ea82eb1604adc3efc1d15a7af759bbf3cd9dc9d78412bf81ab411',
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

-- Migration: 20260604_020000_media_request_expected_release_date.sql
-- Checksum: 4a999b141e3a57728492689376c9fd5e5a8a706e0176b9e9f0778e9e1d68e6d7
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

-- Add expected_release_date to media_requests to support pre-requests for
-- upcoming albums. Stores the anticipated release date so the fulfillment
-- UI can surface a "Coming Soon" indicator without polling discovery state.
ALTER TABLE media_requests ADD COLUMN expected_release_date DATE;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260604_020000',
  '20260604_020000_media_request_expected_release_date.sql',
  'media_request_expected_release_date',
  '4a999b141e3a57728492689376c9fd5e5a8a706e0176b9e9f0778e9e1d68e6d7',
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

-- Migration: 20260615_010000_artwork_provider_quota.sql
-- Checksum: 7617dc4ba3d97626c9313b3b78a2d06f74211c94b9fa93c4c761955f096d24fc
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

-- Artwork provider quota tracking
CREATE TABLE IF NOT EXISTS artwork_provider_quota (
  id            UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  provider      TEXT NOT NULL,
  window_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, window_date)
);

CREATE INDEX IF NOT EXISTS artwork_provider_quota_recent_idx
  ON artwork_provider_quota (provider, window_date DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260615_010000',
  '20260615_010000_artwork_provider_quota.sql',
  'artwork_provider_quota',
  '7617dc4ba3d97626c9313b3b78a2d06f74211c94b9fa93c4c761955f096d24fc',
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

-- Migration: 20260615_020000_artwork_fetch_backoff.sql
-- Checksum: 21aeac8f4b550279ac51c205dc17db86dec1a7f93cb5aad97fef2e7dbd389d09
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

CREATE TABLE IF NOT EXISTS artwork_fetch_failures (
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  artwork_role TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_failed_at TIMESTAMPTZ NOT NULL,
  next_retry_at TIMESTAMPTZ NOT NULL,
  last_failure_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_type, owner_id, artwork_role)
);

CREATE INDEX IF NOT EXISTS artwork_fetch_failures_next_retry_idx
  ON artwork_fetch_failures (next_retry_at ASC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260615_020000',
  '20260615_020000_artwork_fetch_backoff.sql',
  'artwork_fetch_backoff',
  '21aeac8f4b550279ac51c205dc17db86dec1a7f93cb5aad97fef2e7dbd389d09',
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

-- Migration: 20260615_030000_fulfillment_evidence_activity_event_fk.sql
-- Checksum: f936ee4413d4823920ecfed6e077105f12e79bba8ebaa9647fc855b063dfe699
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

-- Add deferred FK from fulfillment_evidence to activity_events.
-- The original migration (20260522) creates the column without the FK constraint
-- because activity_events does not exist until 20260601. The snapshot generator
-- concatenates migrations in timestamp order, so inline FK references to tables
-- created by later migrations cause the snapshot to fail on empty databases.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fulfillment_evidence_matched_activity_event_id_fkey'
  ) THEN
    ALTER TABLE fulfillment_evidence
      ADD CONSTRAINT fulfillment_evidence_matched_activity_event_id_fkey
      FOREIGN KEY (matched_activity_event_id) REFERENCES activity_events(id) ON DELETE SET NULL;
  END IF;
END$$;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260615_030000',
  '20260615_030000_fulfillment_evidence_activity_event_fk.sql',
  'fulfillment_evidence_activity_event_fk',
  'f936ee4413d4823920ecfed6e077105f12e79bba8ebaa9647fc855b063dfe699',
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

-- Migration: 20260622_010000_media_request_cancel_state.sql
-- Checksum: ad21d88d9297d65fb178f947b928ed2c79fb300bde3f1f76e389bb4b42fbd768
-- Expand media_requests.request_state to support cancelled and failed states.
--
-- The application layer already references these states in dedup queries
-- (media_request_store.findActiveDuplicateRequest) and client presentation
-- (request-status.js STATUS_MAP), but the CHECK constraint did not include them.
-- This migration makes the constraint consistent with the application logic.

ALTER TABLE media_requests
  DROP CONSTRAINT media_requests_state_check,
  ADD CONSTRAINT media_requests_state_check
    CHECK (request_state IN (
      'already_exists',
      'cancelled',
      'failed',
      'needs_fetch',
      'needs_review'
    ));

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260622_010000',
  '20260622_010000_media_request_cancel_state.sql',
  'media_request_cancel_state',
  'ad21d88d9297d65fb178f947b928ed2c79fb300bde3f1f76e389bb4b42fbd768',
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

-- Migration: 20260623_010000_media_request_keyset_pagination_index.sql
-- Checksum: f07b77b27e1256a3676383b007e4ce181d9d3aac243101bc59bb766b99a23115
-- Composite index for keyset (cursor-based) pagination on media_requests.
--
-- The cursor-based listMediaRequests query uses row-value comparison:
--   WHERE (created_at, id) < ($N, $N)
--   ORDER BY created_at DESC, id DESC
--
-- Without a matching composite index the planner falls back to a sequential
-- scan with an external sort.  With this index it can perform a backward
-- index scan that satisfies both the filter and the ORDER BY in a single
-- pass, giving O(log n) page lookups at any depth.

CREATE INDEX IF NOT EXISTS idx_media_requests_created_at_id_desc
  ON media_requests (created_at DESC, id DESC);

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260623_010000',
  '20260623_010000_media_request_keyset_pagination_index.sql',
  'media_request_keyset_pagination_index',
  'f07b77b27e1256a3676383b007e4ce181d9d3aac243101bc59bb766b99a23115',
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

-- Migration: 20260624_010000_monitored_by_user_attribution.sql
-- Checksum: 7eed0d9da11d0201e5e33c4fb4ab5fcbf7969ec320a743470c889ae54f2b8b69
ALTER TABLE metadata_artist_monitoring
  ADD COLUMN IF NOT EXISTS monitored_by_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL;

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260624_010000',
  '20260624_010000_monitored_by_user_attribution.sql',
  'monitored_by_user_attribution',
  '7eed0d9da11d0201e5e33c4fb4ab5fcbf7969ec320a743470c889ae54f2b8b69',
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

-- Migration: 20260625_010000_operator_artist_monitoring_baseline.sql
-- Checksum: 14e2d879e0b46e5c682fa5b5fb7c83685f3a1380d7b1af75c98139f9caafa39c
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

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260625_010000',
  '20260625_010000_operator_artist_monitoring_baseline.sql',
  'operator_artist_monitoring_baseline',
  '14e2d879e0b46e5c682fa5b5fb7c83685f3a1380d7b1af75c98139f9caafa39c',
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

-- Migration: 20260625_020000_operator_release_group_selection_baseline.sql
-- Checksum: 9fa1d8cb1da706b49381722012a9d95e646a4cc9b36bb4496fec1a6022e4d4f2
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

INSERT INTO schema_migrations (
  migration_key,
  filename,
  description,
  checksum,
  status
)
VALUES (
  '20260625_020000',
  '20260625_020000_operator_release_group_selection_baseline.sql',
  'operator_release_group_selection_baseline',
  '9fa1d8cb1da706b49381722012a9d95e646a4cc9b36bb4496fec1a6022e4d4f2',
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
