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

function resolveQueryable(queryable) {
  return queryable ?? getPool();
}

function numberOrNull(value) {
  return value == null ? null : Number(value);
}

function mapImportCandidate(row) {
  return {
    id: row.id,
    sourceProvider: row.source_provider,
    sourceSearchId: row.source_search_id,
    sourceResponseKey: row.source_response_key,
    username: row.username,
    folderPath: row.folder_path,
    candidateType: row.candidate_type,
    status: row.status,
    downloadAttemptCount: Number.parseInt(String(row.download_attempt_count ?? 0), 10) || 0,
    fileCount: row.file_count,
    lockedFileCount: row.locked_file_count,
    totalSizeBytes: numberOrNull(row.total_size_bytes),
    rawPayload: row.raw_payload,
    normalizedPayload: row.normalized_payload,
    selectionReason: row.selection_reason ?? null,
    discoveredAt: row.discovered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImportCandidateFile(row) {
  return {
    id: row.id,
    importCandidateId: row.import_candidate_id,
    sourceFileIndex: row.source_file_index,
    filename: row.filename,
    folderPath: row.folder_path,
    extension: row.extension,
    sizeBytes: numberOrNull(row.size_bytes),
    bitRateKbps: row.bit_rate_kbps,
    bitDepth: row.bit_depth,
    lengthSeconds: row.length_seconds,
    sampleRateHz: row.sample_rate_hz,
    isLocked: row.is_locked,
    rawPayload: row.raw_payload,
    createdAt: row.created_at,
  };
}

function mapImportCandidateEvent(row) {
  return {
    id: row.id,
    importCandidateId: row.import_candidate_id,
    eventType: row.event_type,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    reason: row.reason,
    actorUserId: row.actor_user_id,
    details: row.details,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listImportCandidates({
  folderPath = null,
  limit,
  offset,
  requestedForUserId = null,
  sourceSearchId = null,
  status = null,
  username = null,
}, queryable) {
  const db = resolveQueryable(queryable);
  const clauses = [];
  const values = [];

  function addClause(sql, value) {
    values.push(value);
    clauses.push(sql.replace('$value', `$${values.length}`));
  }

  if (status) {
    addClause('status = $value', status);
  }

  if (sourceSearchId) {
    addClause('source_search_id = $value', sourceSearchId);
  }

  if (username) {
    addClause("username ILIKE $value ESCAPE '\\'", `%${escapeLikePattern(username)}%`);
  }

  if (folderPath) {
    addClause("folder_path ILIKE $value ESCAPE '\\'", `%${escapeLikePattern(folderPath)}%`);
  }

  if (requestedForUserId) {
    addClause("normalized_payload -> 'requestOwnership' ->> 'sourceRequestedForUserId' = $value", requestedForUserId);
  }

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await db.query(
    `
      SELECT
        import_candidates.*,
        COUNT(*) OVER()::integer AS total_count
      FROM import_candidates
      ${whereSql}
      ORDER BY (normalized_payload->>'compositeScore')::numeric DESC NULLS LAST, discovered_at DESC, created_at DESC, id ASC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    values,
  );

  return {
    items: result.rows.map(mapImportCandidate),
    total: result.rows[0]?.total_count ?? 0,
  };
}

export async function listImportCandidatesBySourceMediaRequestIds(sourceMediaRequestIds, queryable) {
  if (!Array.isArray(sourceMediaRequestIds) || sourceMediaRequestIds.length === 0) {
    return [];
  }

  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT *
      FROM import_candidates
      WHERE normalized_payload -> 'requestOwnership' ->> 'sourceMediaRequestId' = ANY($1::text[])
      ORDER BY (normalized_payload->>'compositeScore')::numeric DESC NULLS LAST, discovered_at DESC, created_at DESC, id ASC
    `,
    [sourceMediaRequestIds],
  );

  return result.rows.map(mapImportCandidate);
}

export async function getImportCandidateById(importCandidateId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    'SELECT * FROM import_candidates WHERE id = $1 LIMIT 1',
    [importCandidateId],
  );

  return result.rows[0] ? mapImportCandidate(result.rows[0]) : null;
}

export async function listImportCandidateFiles(importCandidateId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      SELECT *
      FROM import_candidate_files
      WHERE import_candidate_id = $1
      ORDER BY source_file_index ASC
    `,
    [importCandidateId],
  );

  return result.rows.map(mapImportCandidateFile);
}

export async function transitionImportCandidateStatus({
  fromStatuses,
  importCandidateId,
  toStatus,
}, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      UPDATE import_candidates
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
        AND status = ANY($3::text[])
      RETURNING *
    `,
    [importCandidateId, toStatus, fromStatuses],
  );

  return result.rows[0] ? mapImportCandidate(result.rows[0]) : null;
}

export async function incrementImportCandidateDownloadAttemptCount({
  importCandidateId,
}, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      UPDATE import_candidates
      SET download_attempt_count = download_attempt_count + 1,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [importCandidateId],
  );

  return result.rows[0] ? mapImportCandidate(result.rows[0]) : null;
}

export async function findNextCandidateForRecovery({
  excludeCandidateIds = null,
  excludeCandidateId,
  maxDownloadAttemptCount,
  metadataReleaseId = null,
  sourceSearchId = null,
}, queryable) {
  const db = resolveQueryable(queryable);
  const excludedIds = Array.isArray(excludeCandidateIds)
    ? excludeCandidateIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())
    : [];
  const hasExcludedIdArray = excludedIds.length > 0;
  const result = await db.query(
    `
      SELECT *
      FROM import_candidates
      WHERE ${hasExcludedIdArray ? 'id <> ALL($5::text[])' : 'id <> $1'}
        AND status IN ('pending', 'held')
        AND download_attempt_count < $4
        AND (
          ($2::text IS NOT NULL AND source_search_id = $2::text)
          OR (
            $3::text IS NOT NULL
            AND normalized_payload #>> '{requestOwnership,metadataReleaseId}' = $3::text
          )
        )
      ORDER BY
        CASE WHEN $2::text IS NOT NULL AND source_search_id = $2::text THEN 0 ELSE 1 END ASC,
        (normalized_payload->>'compositeScore')::numeric DESC NULLS LAST,
        file_count DESC,
        discovered_at ASC,
        id ASC
      LIMIT 1
    `,
    [
      excludeCandidateId,
      sourceSearchId,
      metadataReleaseId,
      maxDownloadAttemptCount,
      ...(hasExcludedIdArray ? [excludedIds] : []),
    ],
  );

  return result.rows[0] ? mapImportCandidate(result.rows[0]) : null;
}

export async function promoteImportCandidateForRecovery({
  importCandidateId,
  maxDownloadAttemptCount,
  reason = null,
  triggeredByFailedCandidateId,
}, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      UPDATE import_candidates
      SET status = 'selected',
          selection_reason = 'recovery_cascade',
          normalized_payload = COALESCE(normalized_payload, '{}'::jsonb) || jsonb_build_object(
            'recoveryCascade',
            jsonb_build_object(
              'promotedAt', NOW(),
              'reason', $3::text,
              'triggeredByFailedCandidateId', $2::text
            )
          ),
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('pending', 'held')
        AND download_attempt_count < $4
      RETURNING *
    `,
    [
      importCandidateId,
      triggeredByFailedCandidateId,
      reason,
      maxDownloadAttemptCount,
    ],
  );

  return result.rows[0] ? mapImportCandidate(result.rows[0]) : null;
}

export async function insertImportCandidateEvent(event, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO import_candidate_events (
        import_candidate_id,
        event_type,
        previous_status,
        new_status,
        reason,
        actor_user_id,
        details,
        occurred_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      RETURNING *
    `,
    [
      event.importCandidateId,
      event.eventType,
      event.previousStatus ?? null,
      event.newStatus ?? null,
      event.reason ?? null,
      event.actorUserId ?? null,
      event.details ? JSON.stringify(event.details) : null,
    ],
  );

  return mapImportCandidateEvent(result.rows[0]);
}

export async function upsertImportCandidate(candidate, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO import_candidates (
        source_provider,
        source_search_id,
        source_response_key,
        username,
        folder_path,
        candidate_type,
        status,
        file_count,
        locked_file_count,
        total_size_bytes,
        raw_payload,
        normalized_payload,
        discovered_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, NOW())
      ON CONFLICT (source_provider, source_search_id, source_response_key) DO UPDATE
      SET username = EXCLUDED.username,
          folder_path = EXCLUDED.folder_path,
          candidate_type = EXCLUDED.candidate_type,
          file_count = EXCLUDED.file_count,
          locked_file_count = EXCLUDED.locked_file_count,
          total_size_bytes = EXCLUDED.total_size_bytes,
          raw_payload = EXCLUDED.raw_payload,
          normalized_payload = EXCLUDED.normalized_payload,
          discovered_at = EXCLUDED.discovered_at,
          updated_at = NOW()
      RETURNING *
    `,
    [
      candidate.sourceProvider,
      candidate.sourceSearchId,
      candidate.sourceResponseKey,
      candidate.username,
      candidate.folderPath,
      candidate.candidateType,
      candidate.status,
      candidate.fileCount,
      candidate.lockedFileCount,
      candidate.totalSizeBytes,
      JSON.stringify(candidate.rawPayload),
      JSON.stringify(candidate.normalizedPayload),
      candidate.discoveredAt,
    ],
  );

  return mapImportCandidate(result.rows[0]);
}

export async function replaceImportCandidateFiles(importCandidateId, files, queryable) {
  const db = resolveQueryable(queryable);
  await db.query('DELETE FROM import_candidate_files WHERE import_candidate_id = $1', [importCandidateId]);

  const storedFiles = [];
  for (const file of files) {
    const result = await db.query(
      `
        INSERT INTO import_candidate_files (
          import_candidate_id,
          source_file_index,
          filename,
          folder_path,
          extension,
          size_bytes,
          bit_rate_kbps,
          bit_depth,
          length_seconds,
          sample_rate_hz,
          is_locked,
          raw_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
        RETURNING *
      `,
      [
        importCandidateId,
        file.sourceFileIndex,
        file.filename,
        file.folderPath,
        file.extension,
        file.sizeBytes,
        file.bitRateKbps,
        file.bitDepth,
        file.lengthSeconds,
        file.sampleRateHz,
        file.isLocked,
        file.rawPayload ? JSON.stringify(file.rawPayload) : null,
      ],
    );
    storedFiles.push(mapImportCandidateFile(result.rows[0]));
  }

  return storedFiles;
}
