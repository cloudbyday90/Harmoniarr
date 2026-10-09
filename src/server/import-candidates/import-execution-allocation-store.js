/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError } from '../auth.js';
import { writableExecutionRunSql } from './import-execution-origin-sql.js';

export async function lockExecutionCandidateAllocation({ importCandidateId, requireSelected = true, queryable }) {
  const result = await queryable.query('SELECT id,status FROM import_candidates WHERE id=$1::uuid FOR UPDATE', [importCandidateId]);
  if (!result.rows[0] || (requireSelected && result.rows[0].status !== 'selected')) {
    throw createApiError(409, 'import_candidate_execution_candidate_not_selected', 'The match is no longer ready to download');
  }
}

/** The short run-row lock serializes lease acquisition with retirement, without holding candidate/IO locks. */
export async function lockExecutionRunLeaseAdmission({ runId, operationType = 'import_candidate_execution_planning', queryable }) {
  const result = await queryable.query(`SELECT id FROM operation_runs WHERE id=$1::uuid
    AND operation_type=$2::text AND ${writableExecutionRunSql('operation_runs')} FOR UPDATE`, [runId, operationType]);
  return result.rowCount > 0;
}
