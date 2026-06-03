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
-- Adds the content-addressed spectral measurement cache and extends the
-- spectral job queue so it can carry library-wide retroactive scans and the
-- content fingerprint used for both decode reuse and cross-peer correlation.

BEGIN;

-- Content-addressed cache of raw spectral measurements. Keyed by the sampled
-- content fingerprint so an identical file is decoded by ffmpeg at most once,
-- no matter how many peers or library copies reference it.
CREATE TABLE IF NOT EXISTS source_user_spectral_cache (
  content_hash TEXT PRIMARY KEY
    CHECK (length(btrim(content_hash)) > 0),
  cutoff_hz INTEGER
    CHECK (cutoff_hz IS NULL OR cutoff_hz >= 0),
  frame_count INTEGER NOT NULL DEFAULT 0
    CHECK (frame_count >= 0),
  duration_ms INTEGER
    CHECK (duration_ms IS NULL OR duration_ms >= 0),
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- origin distinguishes apply-path jobs (tied to a real source user) from
-- retroactive library re-grade jobs (a sentinel username). content_hash links a
-- job to its cached measurement and lets confirmed transcodes be correlated
-- across peers. library_file_id ties retroactive jobs back to the catalog row.
ALTER TABLE source_user_spectral_jobs
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'apply'
    CHECK (origin IN ('apply', 'retroactive')),
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS library_file_id UUID;

-- Correlation index for collusion detection: confirmed transcodes sharing a
-- fingerprint across distinct peers.
CREATE INDEX IF NOT EXISTS source_user_spectral_jobs_content_hash_idx
  ON source_user_spectral_jobs (content_hash)
  WHERE content_hash IS NOT NULL;

-- Dedupe support for retroactive enqueue (one open job per library file).
CREATE INDEX IF NOT EXISTS source_user_spectral_jobs_library_file_idx
  ON source_user_spectral_jobs (library_file_id)
  WHERE library_file_id IS NOT NULL AND state IN ('pending', 'active');

COMMIT;
