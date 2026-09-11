/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

export function createLibraryExternalRequestCollectionProgressStore({ getPoolFn = getPool } = {}) {
  async function getPreparationProgress({ mediaRequestId, requestedForUserId, revision, queryable = null }) {
    const result = await (queryable ?? getPoolFn()).query(`
      SELECT collection.revision, collection.status, collection.pages_completed, collection.items_seen,
        (SELECT COUNT(*)::int FROM library_external_request_collection_items
          WHERE media_request_id = collection.media_request_id) AS leaves_captured,
        work.*, operations.*
      FROM library_external_request_collections collection
      JOIN media_requests request ON request.id = collection.media_request_id
        AND request.requested_for_user_id = collection.requested_for_user_id
      CROSS JOIN LATERAL (
        SELECT COUNT(*)::int AS work_total,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS work_completed,
          COUNT(*) FILTER (WHERE status = 'planned')::int AS work_pending,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS work_failed,
          COUNT(*) FILTER (WHERE status = 'processing')::int AS work_processing,
          COUNT(*) FILTER (WHERE status = 'unsupported')::int AS work_unsupported,
          COUNT(*) FILTER (WHERE ingest_target_type = ANY($5::text[]))::int AS page_total,
          COUNT(*) FILTER (WHERE ingest_target_type = ANY($5::text[]) AND status = 'completed')::int AS page_completed,
          COUNT(*) FILTER (WHERE ingest_target_type = ANY($5::text[]) AND status = 'planned')::int AS page_pending,
          COUNT(*) FILTER (WHERE ingest_target_type = ANY($5::text[]) AND status = 'failed')::int AS page_failed,
          COUNT(*) FILTER (WHERE ingest_target_type = ANY($5::text[]) AND status = 'completed'
            AND next_page_cursor IS NULL)::int AS terminal_pages
        FROM provider_ingest_requests
        WHERE media_request_id = collection.media_request_id AND ingest_key IS NOT NULL
      ) work
      CROSS JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS operations_queued,
          COUNT(*) FILTER (WHERE status = 'running')::int AS operations_running
        FROM operation_runs
        WHERE summary->>'mediaRequestId' = collection.media_request_id::text
          AND operation_type = ANY($4::text[]) AND status IN ('pending', 'running')
          AND cancel_requested_at IS NULL AND cancelled_at IS NULL
          AND collection.status = 'preparing'
      ) operations
      WHERE collection.media_request_id = $1::uuid
        AND collection.requested_for_user_id = $2::uuid AND collection.revision = $3::bigint
        AND request.request_kind = 'external_url' AND request.request_state = 'needs_fetch'
    `, [mediaRequestId, requestedForUserId, revision,
      [operationRunRegistry.libraryExternalIntakePlanning.operationType, operationRunRegistry.libraryExternalIntakeExecution.operationType],
      ['playlist_page', 'artist']]);
    return result.rows[0] ?? null;
  }
  return { getPreparationProgress };
}
