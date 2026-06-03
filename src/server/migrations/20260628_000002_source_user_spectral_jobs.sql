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

-- Durable work queue for the spectral-cutoff DSP sidecar. Fake/transcoded
-- lossless detection that requires decoding the full audio stream and running
-- an FFT (the "heavy half") cannot run on the synchronous apply path, so each
-- applied lossless file is enqueued here and analyzed off-path by a bounded
-- worker. The queue is the back-pressure boundary: enqueue is rejected once the
-- pending+active backlog reaches a cap, and jobs are claimed atomically with
-- FOR UPDATE SKIP LOCKED so multiple workers never double-process a file. A
-- confirmed transcode is merged back into the reputation ledger as a low
-- delivered-quality outcome event (the result-merge contract).
CREATE TABLE IF NOT EXISTS source_user_spectral_jobs (
  id UUID PRIMARY KEY DEFAULT harmoniarr_generate_uuid(),
  username_key TEXT NOT NULL,
  username TEXT NOT NULL,
  import_candidate_id TEXT,
  file_path TEXT NOT NULL,
  declared_codec TEXT,
  declared_extension TEXT,
  sample_rate INTEGER,
  bit_rate BIGINT,
  state TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  verdict TEXT,
  cutoff_hz INTEGER,
  estimated_source_bitrate INTEGER,
  analysis JSONB,
  last_error TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_user_spectral_jobs_username_key_not_blank CHECK (length(btrim(username_key)) > 0),
  CONSTRAINT source_user_spectral_jobs_username_not_blank CHECK (length(btrim(username)) > 0),
  CONSTRAINT source_user_spectral_jobs_file_path_not_blank CHECK (length(btrim(file_path)) > 0),
  CONSTRAINT source_user_spectral_jobs_state_valid CHECK (state IN ('pending', 'active', 'done', 'failed')),
  CONSTRAINT source_user_spectral_jobs_attempts_non_negative CHECK (attempts >= 0)
);

-- Partial index drives both the bounded-backlog count (back-pressure) and the
-- FIFO claim ordering for pending work without scanning completed history.
CREATE INDEX IF NOT EXISTS idx_source_user_spectral_jobs_pending
  ON source_user_spectral_jobs (created_at)
  WHERE state = 'pending';

-- Supports stale-claim recovery sweeps over in-flight work.
CREATE INDEX IF NOT EXISTS idx_source_user_spectral_jobs_active_claimed_at
  ON source_user_spectral_jobs (claimed_at)
  WHERE state = 'active';

CREATE INDEX IF NOT EXISTS idx_source_user_spectral_jobs_username_key
  ON source_user_spectral_jobs (username_key);

COMMIT;
