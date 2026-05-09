-- Push subscription registry — one row per browser/device registration.
-- Soft-deleted on 410/412 (invalidated_at set, never hard-deleted immediately).
-- Pruned after 30 days via a background maintenance task.
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  user_id         UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint        TEXT        NOT NULL UNIQUE,
  p256dh          TEXT        NOT NULL,
  auth            TEXT        NOT NULL,
  user_agent      TEXT        NULL,
  invalidated_at  TIMESTAMPTZ NULL,   -- set on 410/412; NULL means active
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active-subscription lookup: used by the notification dispatch path.
CREATE INDEX IF NOT EXISTS user_push_subscriptions_active_idx
  ON user_push_subscriptions (user_id, invalidated_at)
  WHERE invalidated_at IS NULL;

-- Async notification delivery queue — decouples event emitters from webpush I/O.
-- Background worker polls pending rows and calls webpush.sendNotification().
CREATE TABLE IF NOT EXISTS notification_queue (
  id               UUID        PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  user_id          UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  subscription_id  UUID        NULL REFERENCES user_push_subscriptions(id) ON DELETE CASCADE,
  event_type       TEXT        NOT NULL,
  coalesce_key     TEXT        NULL,   -- groups related events within the 2-min coalesce window
  payload          JSONB       NOT NULL,
  ttl_seconds      INTEGER     NOT NULL CHECK (ttl_seconds > 0),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'sent', 'failed', 'expired')),
  attempts         INTEGER     NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at          TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary worker polling index: pending rows ordered by delivery time.
CREATE INDEX IF NOT EXISTS notification_queue_pending_delivery_idx
  ON notification_queue (next_attempt_at ASC)
  WHERE status = 'pending';

-- Coalescing check: find an unprocessed row matching the same (user, type, coalesce_key)
-- within the last 2 minutes to determine whether to insert or update.
CREATE INDEX IF NOT EXISTS notification_queue_coalesce_lookup_idx
  ON notification_queue (user_id, event_type, coalesce_key, created_at DESC)
  WHERE status = 'pending' AND coalesce_key IS NOT NULL;
