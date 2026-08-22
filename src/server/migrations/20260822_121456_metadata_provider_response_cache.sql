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

-- forward-only migration
BEGIN;

-- A current, normalized external metadata response cache. This is intentionally
-- separate from metadata_provider_snapshots: snapshots are append-only audit
-- evidence, while this table has one mutable row per application-defined cache
-- namespace and normalized key for low-latency SWR reads.
CREATE TABLE IF NOT EXISTS metadata_provider_response_cache (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  cache_namespace TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT metadata_provider_response_cache_namespace_not_blank
    CHECK (length(btrim(cache_namespace)) > 0),
  CONSTRAINT metadata_provider_response_cache_key_not_blank
    CHECK (length(btrim(cache_key)) > 0),
  CONSTRAINT metadata_provider_response_cache_payload_object
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT metadata_provider_response_cache_namespace_key_unique
    UNIQUE (cache_namespace, cache_key)
);

CREATE INDEX IF NOT EXISTS metadata_provider_response_cache_fetched_at_idx
  ON metadata_provider_response_cache (fetched_at);

COMMIT;
