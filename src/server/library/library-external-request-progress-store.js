/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

const operationTypes = [
  operationRunRegistry.libraryExternalIntakePlanning.operationType,
  operationRunRegistry.libraryExternalIntakeExecution.operationType,
  operationRunRegistry.libraryExternalRequestDiscovery.operationType,
];

export function createLibraryExternalRequestProgressStore({ getPoolFn = getPool } = {}) {
  async function listExternalRequestProgressByIds({ mediaRequestIds }) {
    const ids = [...new Set(mediaRequestIds.filter((id) => typeof id === 'string' && id))];
    if (ids.length === 0) return [];

    // Keep provider payloads, URLs, errors, and actor identities out of this read.
    const result = await getPoolFn().query(`
      SELECT DISTINCT ON (summary->>'mediaRequestId')
        summary->>'mediaRequestId' AS media_request_id,
        operation_type,
        status,
        COALESCE(finished_at, started_at, created_at) AS occurred_at,
        summary->>'failedCount' AS failed_count,
        (
          SELECT COUNT(*) FROM provider_ingest_requests intake
          WHERE intake.media_request_id = (operation_runs.summary->>'mediaRequestId')::uuid
            AND intake.status = 'planned'
        ) AS pending_request_count
      FROM operation_runs
      WHERE operation_type = ANY($1::text[])
        AND summary->>'mediaRequestId' = ANY($2::text[])
        AND (operation_type <> $3 OR EXISTS (
          SELECT 1 FROM library_external_request_release_intents intent
          JOIN media_requests request ON request.id = intent.media_request_id
          WHERE intent.operation_run_id = operation_runs.id
            AND intent.requested_for_user_id = request.requested_for_user_id
        ))
      ORDER BY summary->>'mediaRequestId',
        CASE WHEN status IN ('pending', 'running') THEN 0 ELSE 1 END,
        created_at DESC, id DESC
    `, [operationTypes, ids, operationTypes[2]]);

    return result.rows.map((row) => ({
      mediaRequestId: row.media_request_id,
      phase: row.operation_type === operationTypes[2] ? 'discovery' : row.operation_type === operationTypes[1] ? 'execution' : 'planning',
      status: row.status,
      occurredAt: row.occurred_at ?? null,
      failedCount: Math.max(0, Number.parseInt(row.failed_count, 10) || 0),
      pendingRequestCount: Math.max(0, Number.parseInt(row.pending_request_count, 10) || 0),
    }));
  }

  return { listExternalRequestProgressByIds };
}
