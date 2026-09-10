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
      ORDER BY summary->>'mediaRequestId',
        CASE WHEN status IN ('pending', 'running') THEN 0 ELSE 1 END,
        created_at DESC, id DESC
    `, [operationTypes, ids]);

    return result.rows.map((row) => ({
      mediaRequestId: row.media_request_id,
      phase: row.operation_type === operationTypes[1] ? 'execution' : 'planning',
      status: row.status,
      occurredAt: row.occurred_at ?? null,
      failedCount: Math.max(0, Number.parseInt(row.failed_count, 10) || 0),
      pendingRequestCount: Math.max(0, Number.parseInt(row.pending_request_count, 10) || 0),
    }));
  }

  return { listExternalRequestProgressByIds };
}
