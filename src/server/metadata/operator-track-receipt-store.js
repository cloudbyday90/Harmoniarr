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
      SELECT receipt.import_candidate_id, receipt.receipt,
        CASE WHEN invalid.scan_run_id IS NOT NULL THEN jsonb_build_object('runId',invalid.scan_run_id,
          'libraryPath',invalid.library_path,'revisionId',invalid.receipt_revision_id,
          'acquisitionId',invalid.scan_acquisition_id) END AS scan_invalidation
      FROM operator_track_receipts receipt LEFT JOIN operator_track_receipt_invalidations invalid
        USING(import_candidate_id,app_user_id,receipt_revision_id)
      WHERE receipt.app_user_id=$1::uuid AND receipt.metadata_release_id=ANY($2::uuid[])
      ORDER BY receipt.import_candidate_id,receipt.app_user_id`, [ownerId, metadataReleaseIds]);
    return result.rows.map(row => ({ ...row.receipt, importCandidateId: row.import_candidate_id,
      ...(row.scan_invalidation ? { scanInvalidation: row.scan_invalidation } : {}) }));
  }
  return { listFulfillment };
}
