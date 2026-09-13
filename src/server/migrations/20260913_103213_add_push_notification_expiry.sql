-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

BEGIN;

ALTER TABLE notification_queue ADD COLUMN expires_at TIMESTAMPTZ;
UPDATE notification_queue
  SET expires_at = created_at + (ttl_seconds * INTERVAL '1 second');
ALTER TABLE notification_queue ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX notification_queue_pending_expiry_idx ON notification_queue (expires_at, id)
  WHERE status = 'pending' AND claim_token IS NULL;

COMMIT;
