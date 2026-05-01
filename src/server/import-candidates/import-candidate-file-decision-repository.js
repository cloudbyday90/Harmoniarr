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

function mapImportCandidateFileDecision(row) {
  if (!row) {
    return null;
  }

  return {
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    decisionType: row.decision_type,
    id: row.id,
    importCandidateFileId: row.import_candidate_file_id,
    importCandidateId: row.import_candidate_id,
    reason: row.reason,
    updatedAt: row.updated_at,
  };
}

export async function listImportCandidateFileDecisions({ importCandidateId = null } = {}, queryable) {
  const db = resolveQueryable(queryable);
  const values = [];
  const clauses = [];

  if (importCandidateId) {
    values.push(importCandidateId);
    clauses.push(`import_candidate_id = $${values.length}`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await db.query(
    `
      SELECT *
      FROM import_candidate_file_decisions
      ${whereClause}
      ORDER BY updated_at ASC, created_at ASC
    `,
    values,
  );

  return result.rows.map(mapImportCandidateFileDecision);
}

export async function upsertImportCandidateFileDecision({
  actorUserId = null,
  decisionType,
  importCandidateFileId,
  importCandidateId,
  reason = null,
}, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      INSERT INTO import_candidate_file_decisions (
        import_candidate_id,
        import_candidate_file_id,
        decision_type,
        reason,
        actor_user_id,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (import_candidate_file_id)
      DO UPDATE SET
        import_candidate_id = EXCLUDED.import_candidate_id,
        decision_type = EXCLUDED.decision_type,
        reason = EXCLUDED.reason,
        actor_user_id = EXCLUDED.actor_user_id,
        updated_at = NOW()
      RETURNING *
    `,
    [
      importCandidateId,
      importCandidateFileId,
      decisionType,
      reason,
      actorUserId,
    ],
  );

  return mapImportCandidateFileDecision(result.rows[0]);
}

export async function deleteImportCandidateFileDecision(importCandidateFileId, queryable) {
  const db = resolveQueryable(queryable);
  const result = await db.query(
    `
      DELETE FROM import_candidate_file_decisions
      WHERE import_candidate_file_id = $1
      RETURNING *
    `,
    [importCandidateFileId],
  );

  return mapImportCandidateFileDecision(result.rows[0]);
}