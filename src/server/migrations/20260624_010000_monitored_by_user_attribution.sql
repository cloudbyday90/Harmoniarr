ALTER TABLE metadata_artist_monitoring
  ADD COLUMN IF NOT EXISTS monitored_by_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL;
