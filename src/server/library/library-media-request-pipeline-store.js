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

function numberOrNull(value) {
  return value == null ? null : Number(value);
}

function mapCandidateRow(row) {
  return {
    id: row.id,
    username: row.username,
    folderPath: row.folder_path,
    candidateType: row.candidate_type,
    status: row.status,
    fileCount: row.file_count,
    lockedFileCount: row.locked_file_count,
    totalSizeBytes: numberOrNull(row.total_size_bytes),
    discoveredAt: row.discovered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRunItemRow(row) {
  return {
    operationRunId: row.operation_run_id,
    importCandidateId: row.import_candidate_id,
    itemStatus: row.item_status,
    statusMessage: row.status_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    runStatus: row.run_status,
    runErrorMessage: row.run_error_message,
  };
}

export function createLibraryMediaRequestPipelineStore({
  getPoolFn = getPool,
  queryable = null,
} = {}) {
  async function listPipelineCandidates({ mediaRequestId }) {
    const db = queryable ?? getPoolFn();
    const candidateResult = await db.query(
      `
        SELECT
          id, username, folder_path, candidate_type, status,
          file_count, locked_file_count, total_size_bytes,
          discovered_at, created_at, updated_at
        FROM import_candidates
        WHERE normalized_payload -> 'requestOwnership' ->> 'sourceMediaRequestId' = $1
        ORDER BY
          CASE status
            WHEN 'applied' THEN 0
            WHEN 'import_pending' THEN 1
            WHEN 'downloading' THEN 2
            WHEN 'selected' THEN 3
            WHEN 'pending' THEN 4
            WHEN 'held' THEN 5
            WHEN 'rejected' THEN 6
            WHEN 'failed' THEN 7
            ELSE 8
          END,
          updated_at DESC
      `,
      [mediaRequestId],
    );

    if (candidateResult.rows.length === 0) {
      return [];
    }

    const candidates = candidateResult.rows.map(mapCandidateRow);
    const candidateIds = candidates.map((candidate) => candidate.id);

    const [executionItems, applyItems] = await Promise.all([
      db.query(
        `
          SELECT
            ei.operation_run_id,
            ei.import_candidate_id,
            ei.item_status,
            ei.status_message,
            ei.planning_snapshot,
            or_.started_at,
            or_.finished_at,
            or_.status AS run_status,
            or_.error_message AS run_error_message
          FROM import_execution_run_items ei
          JOIN operation_runs or_ ON or_.id = ei.operation_run_id
          WHERE ei.import_candidate_id = ANY($1::uuid[])
          ORDER BY or_.started_at DESC
        `,
        [candidateIds],
      ),
      db.query(
        `
          SELECT
            ai.operation_run_id,
            ai.import_candidate_id,
            ai.item_status,
            ai.status_message,
            or_.started_at,
            or_.finished_at,
            or_.status AS run_status,
            or_.error_message AS run_error_message
          FROM import_apply_run_items ai
          JOIN operation_runs or_ ON or_.id = ai.operation_run_id
          WHERE ai.import_candidate_id = ANY($1::uuid[])
          ORDER BY or_.started_at DESC
        `,
        [candidateIds],
      ),
    ]);

    const executionByCandidate = new Map();
    for (const row of executionItems.rows) {
      if (!executionByCandidate.has(row.import_candidate_id)) {
        executionByCandidate.set(row.import_candidate_id, {
          ...mapRunItemRow(row),
          planningSnapshot: row.planning_snapshot ?? null,
        });
      }
    }

    const applyByCandidate = new Map();
    for (const row of applyItems.rows) {
      if (!applyByCandidate.has(row.import_candidate_id)) {
        applyByCandidate.set(row.import_candidate_id, mapRunItemRow(row));
      }
    }

    return candidates.map((candidate) => ({
      ...candidate,
      execution: executionByCandidate.get(candidate.id) ?? null,
      apply: applyByCandidate.get(candidate.id) ?? null,
    }));
  }

  return { listPipelineCandidates };
}
