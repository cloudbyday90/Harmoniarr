/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { getPool } from '../database.js';

export const QUALITY_REVIEW_CANDIDATE_PAGE_SIZE = 50;

/** Only policy inputs and bounded-choice facts; no file, peer or provider detail. */
export function createImportCandidateQualityReviewCandidateStore({ getPoolFn = getPool } = {}) {
  async function listCandidatePage({ sourceSearchId, afterId = null, direction = 'next', queryable = null }) {
    const backwards = direction === 'previous';
    const result = await (queryable ?? getPoolFn()).query(`SELECT id,status,source_search_id,file_count,total_size_bytes,
      jsonb_build_object('musicQueue',normalized_payload->'musicQueue','musicQueueContext',normalized_payload->'musicQueueContext',
        'extensions',normalized_payload->'extensions','audioFormat',normalized_payload->'audioFormat',
        'codec',normalized_payload->'codec','extension',normalized_payload->'extension',
        'bitrateKbps',normalized_payload->'bitrateKbps','bitRateKbps',normalized_payload->'bitRateKbps') AS quality_payload
      FROM import_candidates WHERE source_search_id=$1 AND status IN ('pending','held')
        AND ($2::uuid IS NULL OR id${backwards ? '<' : '>'}$2::uuid) ORDER BY id${backwards ? ' DESC' : ''} LIMIT $3 ${queryable ? 'FOR UPDATE' : ''}`,
    [sourceSearchId, afterId, QUALITY_REVIEW_CANDIDATE_PAGE_SIZE]);
    return result.rows.map(row => ({ id: row.id, status: row.status, sourceSearchId: row.source_search_id,
      fileCount: row.file_count, totalSizeBytes: row.total_size_bytes == null ? null : Number(row.total_size_bytes),
      normalizedPayload: row.quality_payload }));
  }
  return { listCandidatePage };
}
