/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function lockImportCandidateApplyCreation({ queryable }) {
  await queryable.query("SELECT pg_advisory_xact_lock(hashtextextended('harmoniarr.import-candidate-apply-start', 0))");
}

export async function lockImportPendingCandidates({ candidateIds, queryable }) {
  if (!candidateIds.length) return true;
  const result = await queryable.query('SELECT id, status FROM import_candidates WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [candidateIds]);
  return result.rows.length === new Set(candidateIds).size && result.rows.every((row) => row.status === 'import_pending');
}
