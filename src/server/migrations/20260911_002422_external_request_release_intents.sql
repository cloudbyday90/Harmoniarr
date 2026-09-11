-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.
--
-- Forward-only migration.
BEGIN;

CREATE TABLE library_external_request_release_intents (
  id uuid PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  media_request_id uuid NOT NULL REFERENCES media_requests(id) ON DELETE CASCADE,
  metadata_release_id uuid NOT NULL REFERENCES metadata_releases(id) ON DELETE RESTRICT,
  requested_for_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  provider_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  operation_run_id uuid REFERENCES operation_runs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT external_request_release_intents_release_unique UNIQUE (media_request_id, metadata_release_id),
  CONSTRAINT external_request_release_intents_provider_unique UNIQUE (media_request_id, provider_key),
  CONSTRAINT external_request_release_intents_evidence_object CHECK (jsonb_typeof(provider_evidence) = 'object')
);

CREATE INDEX external_request_release_intents_target_idx
  ON library_external_request_release_intents (requested_for_user_id);
CREATE INDEX external_request_release_intents_operation_idx
  ON library_external_request_release_intents (operation_run_id);

COMMIT;
