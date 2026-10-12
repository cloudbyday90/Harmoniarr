/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { getPool } from '../database.js';

/** Reads historical candidate-owned evidence; current availability is verified separately. */
export function createOperatorTrackReceiptStore({ getPoolFn = getPool } = {}) {
  async function listFulfillment({ ownerId, metadataReleaseIds, queryable = null }) {
    if (metadataReleaseIds.length === 0) return [];
    const result = await (queryable ?? getPoolFn()).query(`
      SELECT import_candidate_id, receipt FROM operator_track_receipts
      WHERE app_user_id=$1::uuid AND metadata_release_id=ANY($2::uuid[])
      ORDER BY import_candidate_id,app_user_id`, [ownerId, metadataReleaseIds]);
    return result.rows.map(row => ({ ...row.receipt, importCandidateId: row.import_candidate_id }));
  }
  return { listFulfillment };
}
