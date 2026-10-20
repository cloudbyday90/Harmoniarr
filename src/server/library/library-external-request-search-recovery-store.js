/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createLibraryExternalRequestSearchRecoveryStore() {
  async function lockIntent({ mediaRequestId, intentId, queryable }) {
    const result = await queryable.query(`SELECT id FROM library_external_request_release_intents
      WHERE id=$1 AND media_request_id=$2 FOR UPDATE`, [intentId, mediaRequestId]);
    return result.rowCount === 1;
  }
  async function lockRun({ operationRunId, queryable }) {
    const result = await queryable.query(`SELECT id,operation_type,status,summary FROM operation_runs
      WHERE id=$1 FOR UPDATE`, [operationRunId]);
    const row = result.rows[0];
    return row ? { id: row.id, operationType: row.operation_type, status: row.status, summary: row.summary } : null;
  }
  async function supersedeRun({ operationRunId, queryable }) {
    const result = await queryable.query(`UPDATE operation_runs SET
      summary=COALESCE(summary,'{}'::jsonb)||'{"externalSearchSuperseded":true}'::jsonb
      WHERE id=$1 AND operation_type='library_external_request_discovery' AND status='failed'
        AND summary->>'externalSearchSuperseded' IS DISTINCT FROM 'true'`, [operationRunId]);
    return result.rowCount === 1;
  }
  return { lockIntent, lockRun, supersedeRun };
}
