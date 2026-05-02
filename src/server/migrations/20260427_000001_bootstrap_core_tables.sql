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