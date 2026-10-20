-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- Licensed under GPL-3.0-or-later. See LICENSE.

ALTER TABLE library_external_request_release_intents
  ADD COLUMN last_empty_search_run_id uuid,
  ADD COLUMN last_empty_search_at timestamptz,
  ADD COLUMN empty_search_recovery_count integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT external_empty_search_observation CHECK
    ((last_empty_search_run_id IS NULL) = (last_empty_search_at IS NULL)),
  ADD CONSTRAINT external_empty_search_budget CHECK
    (empty_search_recovery_count BETWEEN 0 AND 2
      AND (empty_search_recovery_count = 0 OR last_empty_search_at IS NOT NULL));

-- The observation deliberately survives operation-run history retention.
