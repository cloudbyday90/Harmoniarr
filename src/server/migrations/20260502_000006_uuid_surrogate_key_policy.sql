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