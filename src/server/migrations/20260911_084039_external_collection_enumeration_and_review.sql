-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
--
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.
-- Forward-only migration.
BEGIN;

ALTER TABLE provider_ingest_requests ADD COLUMN ingest_key text;
ALTER TABLE provider_ingest_requests ADD COLUMN next_page_cursor text;
CREATE UNIQUE INDEX provider_ingest_requests_identity_unique
  ON provider_ingest_requests (media_request_id, ingest_key) WHERE ingest_key IS NOT NULL;

CREATE TABLE library_external_request_collections (
  media_request_id uuid PRIMARY KEY REFERENCES media_requests(id) ON DELETE CASCADE,
  requested_for_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  source_provider text NOT NULL CHECK (source_provider IN ('spotify', 'apple_music', 'youtube')),
  source_resource_type text NOT NULL CHECK (source_resource_type IN ('playlist', 'artist')),
  source_identifier text NOT NULL,
  storefront text,
  expansion_policy text NOT NULL DEFAULT 'bounded' CHECK (expansion_policy = 'bounded'),
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'ready', 'blocked', 'reviewed')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  pages_completed integer NOT NULL DEFAULT 0 CHECK (pages_completed >= 0),
  items_seen integer NOT NULL DEFAULT 0 CHECK (items_seen >= 0),
  provider_snapshot text,
  blocked_reason text,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT external_collection_reviewed_state CHECK ((status = 'reviewed') = (reviewed_at IS NOT NULL))
);
CREATE INDEX external_collections_target_idx ON library_external_request_collections (requested_for_user_id);

CREATE TABLE library_external_request_collection_items (
  id uuid PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  media_request_id uuid NOT NULL REFERENCES library_external_request_collections(media_request_id) ON DELETE CASCADE,
  item_key text NOT NULL,
  provider_ingest_request_id uuid REFERENCES provider_ingest_requests(id) ON DELETE SET NULL,
  source_provider text NOT NULL,
  source_identifier text,
  item_kind text NOT NULL CHECK (item_kind IN ('release', 'unsupported')),
  title text,
  artist_name text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'included', 'excluded')),
  release_intent_id uuid REFERENCES library_external_request_release_intents(id) ON DELETE RESTRICT,
  exclusion_reason text,
  decided_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT external_collection_item_identity_unique UNIQUE (media_request_id, item_key),
  CONSTRAINT external_collection_item_decision_consistent CHECK (
    (decision = 'pending' AND release_intent_id IS NULL AND exclusion_reason IS NULL AND decided_at IS NULL)
    OR (decision = 'included' AND item_kind = 'release' AND release_intent_id IS NOT NULL AND exclusion_reason IS NULL AND decided_at IS NOT NULL)
    OR (decision = 'excluded' AND release_intent_id IS NULL AND exclusion_reason IS NOT NULL AND length(btrim(exclusion_reason)) BETWEEN 1 AND 500 AND decided_at IS NOT NULL)
  )
);
CREATE INDEX external_collection_items_page_idx ON library_external_request_collection_items (media_request_id, id);
CREATE INDEX external_collection_items_provider_idx ON library_external_request_collection_items (provider_ingest_request_id);
CREATE INDEX external_collection_items_intent_idx ON library_external_request_collection_items (release_intent_id);

COMMIT;
