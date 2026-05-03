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
