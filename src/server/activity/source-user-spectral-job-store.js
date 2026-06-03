/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { getPool } from '../database.js';
import { buildSourceUserUsernameKey } from './source-user-trust-service.js';

const DEFAULT_MAX_BACKLOG = 500;
const DEFAULT_CLAIM_LIMIT = 4;
const MAX_CLAIM_LIMIT = 50;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_SHARED_FINGERPRINT_LIMIT = 200;
const MAX_SHARED_FINGERPRINT_LIMIT = 1000;

// Sentinel identity for retroactive library re-grade jobs. These jobs are not
// tied to a real source user, but the queue's username columns are NOT NULL, so
// a reserved non-blank sentinel keeps the schema invariant intact while clearly
// marking the rows that must be excluded from peer reputation merges and
// cross-peer collusion correlation.
export const RETROACTIVE_SCAN_USERNAME = '__retroactive_library_scan__';

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeNonNegativeBigInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function clampClaimLimit(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CLAIM_LIMIT;
  }
  return Math.min(parsed, MAX_CLAIM_LIMIT);
}

function toIso(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value ?? null;
}

function mapSpectralJobRow(row) {
  return {
    id: row.id,
    username: row.username,
    usernameKey: row.username_key,
    importCandidateId: row.import_candidate_id ?? null,
    filePath: row.file_path,
    declaredCodec: row.declared_codec ?? null,
    declaredExtension: row.declared_extension ?? null,
    sampleRate: row.sample_rate === null || row.sample_rate === undefined ? null : Number(row.sample_rate),
    bitRate: row.bit_rate === null || row.bit_rate === undefined ? null : Number(row.bit_rate),
    state: row.state,
    attempts: Number(row.attempts ?? 0),
    verdict: row.verdict ?? null,
    cutoffHz: row.cutoff_hz === null || row.cutoff_hz === undefined ? null : Number(row.cutoff_hz),
    estimatedSourceBitrate: row.estimated_source_bitrate === null || row.estimated_source_bitrate === undefined
      ? null
      : Number(row.estimated_source_bitrate),
    analysis: row.analysis ?? null,
    lastError: row.last_error ?? null,
    origin: row.origin ?? 'apply',
    contentHash: row.content_hash ?? null,
    libraryFileId: row.library_file_id ?? null,
    claimedAt: toIso(row.claimed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * Durable work-queue store for the spectral-cutoff DSP sidecar.
 *
 * The queue is the back-pressure boundary between the synchronous apply path
 * and the expensive FFT analysis: `enqueueSpectralJob` refuses new work once the
 * pending+active backlog reaches `maxBacklog`, and `claimNextSpectralJobs` uses
 * `FOR UPDATE SKIP LOCKED` so concurrent drains never double-process a file
 * (the same durable-claim pattern proven by pg-boss). All SQL is fully
 * parameterized.
 */
export function createSourceUserSpectralJobStore({
  getPoolFn = getPool,
  maxBacklog = DEFAULT_MAX_BACKLOG,
} = {}) {
  const backlogCap = normalizePositiveInteger(maxBacklog) ?? DEFAULT_MAX_BACKLOG;

  /**
   * Atomically enqueues a job unless the pending+active backlog is already at
   * the cap. The cap check and the insert are a single statement so concurrent
   * enqueues cannot race past the limit.
   *
   * @returns {Promise<{ enqueued: boolean, job: object | null, reason: string | null }>}
   */
  async function enqueueSpectralJob({
    username,
    importCandidateId = null,
    filePath,
    declaredCodec = null,
    declaredExtension = null,
    sampleRate = null,
    bitRate = null,
  }) {
    const normalizedUsername = normalizeOptionalString(username);
    const normalizedFilePath = typeof filePath === 'string' ? filePath.trim() : '';
    if (!normalizedUsername) {
      throw new Error('enqueueSpectralJob requires username');
    }
    if (!normalizedFilePath) {
      throw new Error('enqueueSpectralJob requires filePath');
    }

    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    if (!usernameKey) {
      throw new Error('enqueueSpectralJob requires a non-blank username');
    }

    const result = await getPoolFn().query(
      `INSERT INTO source_user_spectral_jobs (
         username_key, username, import_candidate_id, file_path,
         declared_codec, declared_extension, sample_rate, bit_rate, state
       )
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'pending'
       WHERE (
         SELECT COUNT(*) FROM source_user_spectral_jobs
         WHERE state IN ('pending', 'active')
       ) < $9
       RETURNING *`,
      [
        usernameKey,
        normalizedUsername,
        normalizeOptionalString(importCandidateId),
        normalizedFilePath,
        normalizeOptionalString(declaredCodec),
        normalizeOptionalString(declaredExtension),
        normalizePositiveInteger(sampleRate),
        normalizeNonNegativeBigInt(bitRate),
        backlogCap,
      ],
    );

    if (result.rows.length === 0) {
      return { enqueued: false, job: null, reason: 'backlog_full' };
    }

    return { enqueued: true, job: mapSpectralJobRow(result.rows[0]), reason: null };
  }

  /**
   * Claims up to `limit` pending jobs and marks them active in one round trip.
   * SKIP LOCKED guarantees disjoint claims across concurrent workers.
   */
  async function claimNextSpectralJobs({ limit = DEFAULT_CLAIM_LIMIT } = {}) {
    const claimLimit = clampClaimLimit(limit);
    const result = await getPoolFn().query(
      `UPDATE source_user_spectral_jobs AS j
       SET state = 'active',
           attempts = j.attempts + 1,
           claimed_at = NOW(),
           updated_at = NOW()
       WHERE j.id IN (
         SELECT id FROM source_user_spectral_jobs
         WHERE state = 'pending'
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       RETURNING *`,
      [claimLimit],
    );

    return result.rows.map(mapSpectralJobRow);
  }

  async function completeSpectralJob({
    id,
    verdict = null,
    cutoffHz = null,
    estimatedSourceBitrate = null,
    analysis = null,
    contentHash = null,
  }) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('completeSpectralJob requires id');
    }

    const result = await getPoolFn().query(
      `UPDATE source_user_spectral_jobs
       SET state = 'done',
           verdict = $2,
           cutoff_hz = $3,
           estimated_source_bitrate = $4,
           analysis = $5,
           content_hash = COALESCE($6, content_hash),
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        normalizeOptionalString(verdict),
        normalizePositiveInteger(cutoffHz),
        normalizePositiveInteger(estimatedSourceBitrate),
        analysis === null || analysis === undefined ? null : JSON.stringify(analysis),
        normalizeOptionalString(contentHash),
      ],
    );

    return result.rows.length === 0 ? null : mapSpectralJobRow(result.rows[0]);
  }

  /**
   * Enqueues a batch of retroactive library re-grade jobs under the reserved
   * sentinel identity. Each insert is guarded by both the global backlog cap and
   * a per-library-file dedupe (no second open job for a file already queued),
   * so repeated scans are idempotent and cannot overrun the queue.
   *
   * @param {object} input
   * @param {Array<{ libraryFileId: string, filePath: string, declaredCodec?: string|null, declaredExtension?: string|null, sampleRate?: number|null, bitRate?: number|null }>} input.files
   * @returns {Promise<{ enqueued: number, skipped: number }>}
   */
  async function enqueueRetroactiveLibraryJobs({ files = [] } = {}) {
    const summary = { enqueued: 0, skipped: 0 };
    if (!Array.isArray(files) || files.length === 0) {
      return summary;
    }

    const usernameKey = buildSourceUserUsernameKey(RETROACTIVE_SCAN_USERNAME);

    for (const file of files) {
      const filePath = typeof file?.filePath === 'string' ? file.filePath.trim() : '';
      const libraryFileId = normalizeOptionalString(file?.libraryFileId);
      if (!filePath || !libraryFileId) {
        summary.skipped += 1;
        continue;
      }

      const result = await getPoolFn().query(
        `INSERT INTO source_user_spectral_jobs (
           username_key, username, file_path, declared_codec, declared_extension,
           sample_rate, bit_rate, origin, library_file_id, state
         )
         SELECT $1, $2, $3, $4, $5, $6, $7, 'retroactive', $8, 'pending'
         WHERE (
           SELECT COUNT(*) FROM source_user_spectral_jobs
           WHERE state IN ('pending', 'active')
         ) < $9
         AND NOT EXISTS (
           SELECT 1 FROM source_user_spectral_jobs
           WHERE library_file_id = $8 AND state IN ('pending', 'active')
         )
         RETURNING id`,
        [
          usernameKey,
          RETROACTIVE_SCAN_USERNAME,
          filePath,
          normalizeOptionalString(file?.declaredCodec),
          normalizeOptionalString(file?.declaredExtension),
          normalizePositiveInteger(file?.sampleRate),
          normalizeNonNegativeBigInt(file?.bitRate),
          libraryFileId,
          backlogCap,
        ],
      );

      if (result.rows.length > 0) {
        summary.enqueued += 1;
      } else {
        summary.skipped += 1;
      }
    }

    return summary;
  }

  /**
   * Returns content fingerprints whose lossless-claimed files were confirmed as
   * transcodes for two or more distinct apply-path peers. This is the raw signal
   * for cross-peer collusion / duplicate-source detection: the same fake file
   * surfacing from multiple uploaders strongly implies a shared upstream source.
   *
   * Retroactive (sentinel) jobs are excluded so a library copy never counts as a
   * peer.
   */
  async function listSharedTranscodeFingerprints({
    minDistinctUsers = 2,
    limit = DEFAULT_SHARED_FINGERPRINT_LIMIT,
  } = {}) {
    const minUsers = Math.max(2, normalizePositiveInteger(minDistinctUsers) ?? 2);
    const rowLimit = Math.min(
      normalizePositiveInteger(limit) ?? DEFAULT_SHARED_FINGERPRINT_LIMIT,
      MAX_SHARED_FINGERPRINT_LIMIT,
    );

    const result = await getPoolFn().query(
      `SELECT content_hash,
              COUNT(DISTINCT username_key)::int AS distinct_users,
              JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT('usernameKey', username_key, 'username', username)) AS members,
              MAX(estimated_source_bitrate) AS estimated_source_bitrate
       FROM source_user_spectral_jobs
       WHERE origin = 'apply'
         AND verdict = 'transcoded'
         AND content_hash IS NOT NULL
       GROUP BY content_hash
       HAVING COUNT(DISTINCT username_key) >= $1
       ORDER BY COUNT(DISTINCT username_key) DESC, content_hash ASC
       LIMIT $2`,
      [minUsers, rowLimit],
    );

    return result.rows.map((row) => ({
      contentHash: row.content_hash,
      distinctUsers: Number(row.distinct_users ?? 0),
      members: Array.isArray(row.members)
        ? row.members
          .filter((member) => member && typeof member.usernameKey === 'string')
          .map((member) => ({ usernameKey: member.usernameKey, username: member.username ?? null }))
        : [],
      estimatedSourceBitrate: row.estimated_source_bitrate === null || row.estimated_source_bitrate === undefined
        ? null
        : Number(row.estimated_source_bitrate),
    }));
  }

  /**
   * Records a failed attempt. If the job still has attempts remaining it returns
   * to `pending` for a later retry; otherwise it is parked in `failed`.
   */
  async function failSpectralJob({ id, error = null, maxAttempts = DEFAULT_MAX_ATTEMPTS }) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('failSpectralJob requires id');
    }

    const attemptCap = normalizePositiveInteger(maxAttempts) ?? DEFAULT_MAX_ATTEMPTS;
    const result = await getPoolFn().query(
      `UPDATE source_user_spectral_jobs
       SET state = CASE WHEN attempts >= $3 THEN 'failed' ELSE 'pending' END,
           claimed_at = NULL,
           last_error = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, normalizeOptionalString(error), attemptCap],
    );

    return result.rows.length === 0 ? null : mapSpectralJobRow(result.rows[0]);
  }

  /**
   * Recovers jobs stuck in `active` (e.g. a worker crashed mid-analysis) by
   * returning those claimed before `olderThanMs` ago to the pending queue.
   */
  async function requeueStaleActiveJobs({ olderThanMs = 10 * 60 * 1000 } = {}) {
    const threshold = normalizePositiveInteger(olderThanMs) ?? 10 * 60 * 1000;
    const result = await getPoolFn().query(
      `UPDATE source_user_spectral_jobs
       SET state = 'pending',
           claimed_at = NULL,
           updated_at = NOW()
       WHERE state = 'active'
         AND claimed_at IS NOT NULL
         AND claimed_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')
       RETURNING id`,
      [threshold],
    );

    return result.rowCount ?? result.rows.length;
  }

  async function countPendingSpectralJobs() {
    const result = await getPoolFn().query(
      `SELECT COUNT(*)::int AS pending
       FROM source_user_spectral_jobs
       WHERE state IN ('pending', 'active')`,
    );
    return result.rows[0]?.pending ?? 0;
  }

  /**
   * Prunes terminal (done/failed) jobs older than the retention window.
   */
  async function pruneSpectralJobs({ olderThanMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
    const threshold = normalizePositiveInteger(olderThanMs) ?? 7 * 24 * 60 * 60 * 1000;
    const result = await getPoolFn().query(
      `DELETE FROM source_user_spectral_jobs
       WHERE state IN ('done', 'failed')
         AND updated_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')`,
      [threshold],
    );
    return result.rowCount ?? 0;
  }

  return {
    claimNextSpectralJobs,
    completeSpectralJob,
    countPendingSpectralJobs,
    enqueueRetroactiveLibraryJobs,
    enqueueSpectralJob,
    failSpectralJob,
    listSharedTranscodeFingerprints,
    pruneSpectralJobs,
    requeueStaleActiveJobs,
  };
}
