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
