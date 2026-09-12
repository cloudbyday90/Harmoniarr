-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

BEGIN;

ALTER TABLE notification_queue ADD COLUMN claim_token UUID;
ALTER TABLE notification_queue ADD CONSTRAINT notification_queue_claim_pending_check
  CHECK (claim_token IS NULL OR status = 'pending');

COMMIT;
