-- Harmoniarr - Soulseek-native music library management
-- Copyright (C) 2026 Harmoniarr Contributors
-- This program is free software: licensed under GPL-3.0
-- See LICENSE file for details.

BEGIN;

CREATE INDEX user_push_subscriptions_invalidated_pruning_idx ON user_push_subscriptions (invalidated_at, id)
  WHERE invalidated_at IS NOT NULL;
CREATE INDEX notification_queue_subscription_reference_idx ON notification_queue (subscription_id)
  WHERE subscription_id IS NOT NULL;

COMMIT;
