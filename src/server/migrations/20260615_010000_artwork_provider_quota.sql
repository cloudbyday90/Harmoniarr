-- Artwork provider quota tracking
CREATE TABLE IF NOT EXISTS artwork_provider_quota (
  id            UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  provider      TEXT NOT NULL,
  window_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, window_date)
);

CREATE INDEX IF NOT EXISTS artwork_provider_quota_recent_idx
  ON artwork_provider_quota (provider, window_date DESC);
