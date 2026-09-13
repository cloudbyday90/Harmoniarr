-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

BEGIN;

ALTER TABLE notification_queue ADD COLUMN terminal_at TIMESTAMPTZ;
-- Unknown historical completion times receive a conservative retention baseline,
-- not an invented failure time. No rows are deleted during migration.
WITH baseline AS MATERIALIZED (SELECT clock_timestamp() AS recorded_at)
UPDATE notification_queue SET terminal_at =
  CASE WHEN status = 'sent' AND sent_at IS NOT NULL THEN sent_at ELSE baseline.recorded_at END
FROM baseline WHERE status IN ('sent', 'failed', 'expired');

ALTER TABLE notification_queue ADD CONSTRAINT notification_queue_terminal_state_check CHECK (
  (status = 'pending' AND terminal_at IS NULL)
  OR (status IN ('sent', 'failed', 'expired') AND terminal_at IS NOT NULL AND isfinite(terminal_at))
);
CREATE INDEX notification_queue_terminal_retention_idx ON notification_queue (terminal_at, id)
  WHERE status IN ('sent', 'failed', 'expired') AND claim_token IS NULL;

COMMIT;
