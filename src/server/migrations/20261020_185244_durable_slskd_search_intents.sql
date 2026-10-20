-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0-or-later.
-- See LICENSE for details. Forward-only migration.
BEGIN;

CREATE TABLE slskd_search_intents (
  id uuid PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  discovery_request_id uuid REFERENCES library_discovery_requests(id) ON DELETE CASCADE,
  external_request_intent_id uuid REFERENCES library_external_request_release_intents(id) ON DELETE CASCADE,
  intent_fingerprint text NOT NULL,
  provider_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  CONSTRAINT slskd_search_intents_owner_check CHECK (
    num_nonnulls(discovery_request_id, external_request_intent_id) = 1
  ),
  CONSTRAINT slskd_search_intents_fingerprint_check CHECK (
    intent_fingerprint ~ '^[0-9a-f]{64}$' AND provider_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT slskd_search_intents_expiry_check CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX slskd_search_intents_discovery_unique
  ON slskd_search_intents (discovery_request_id, intent_fingerprint)
  WHERE discovery_request_id IS NOT NULL;
CREATE UNIQUE INDEX slskd_search_intents_external_unique
  ON slskd_search_intents (external_request_intent_id, intent_fingerprint)
  WHERE external_request_intent_id IS NOT NULL;

COMMIT;
