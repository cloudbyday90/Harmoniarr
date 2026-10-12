/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { insertImportCandidateEvent } from '../import-candidates/import-candidate-repository.js';

export function createLibraryScanReceiptStore() {
  async function listForRoot({ root, queryable }) {
    const normalized = root.replaceAll('\\', '/').replace(/\/+$/u, '');
    const prefix = value => value.toLowerCase().replace(/[\\%_]/gu, '\\$&') + '/%';
    // Windows rooted paths without a drive are valid on the process's current
    // drive. Select that notation too; host containment still rejects another drive.
    const rooted = process.platform === 'win32' && /^[A-Za-z]:\//u.test(normalized) ? normalized.slice(2) : null;
    return (await queryable.query(`SELECT import_candidate_id,app_user_id,receipt_revision_id,receipt
      FROM operator_track_receipts WHERE lower(replace(library_path,chr(92),'/')) LIKE $1
        OR lower(replace(library_path,chr(92),'/')) LIKE $2
      ORDER BY import_candidate_id,app_user_id`, [prefix(normalized), rooted ? prefix(rooted) : null])).rows;
  }
  async function lockReceipt({ target, queryable }) {
    const parent = (await queryable.query("SELECT status FROM import_candidates WHERE id=$1::uuid FOR SHARE", [target.candidateId])).rows[0];
    if (parent?.status !== 'applied') return null;
    return (await queryable.query(`SELECT receipt_revision_id,receipt FROM operator_track_receipts
      WHERE import_candidate_id=$1::uuid AND app_user_id=$2::uuid FOR SHARE`, [target.candidateId, target.ownerId])).rows[0] ?? null;
  }
  async function recordMissing({ target, prepared, libraryRootId, queryable }) {
    return (await queryable.query(`INSERT INTO operator_track_receipt_invalidations
      (import_candidate_id,app_user_id,receipt_revision_id,library_root_id,scan_run_id,scan_acquisition_id,library_path)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7)
      ON CONFLICT(import_candidate_id,app_user_id) DO UPDATE SET
        receipt_revision_id=EXCLUDED.receipt_revision_id,library_root_id=EXCLUDED.library_root_id,
        scan_run_id=EXCLUDED.scan_run_id,scan_acquisition_id=EXCLUDED.scan_acquisition_id,
        library_path=EXCLUDED.library_path,observed_at=clock_timestamp()
      WHERE operator_track_receipt_invalidations.scan_run_id IS DISTINCT FROM EXCLUDED.scan_run_id
        OR operator_track_receipt_invalidations.scan_acquisition_id IS DISTINCT FROM EXCLUDED.scan_acquisition_id
      RETURNING import_candidate_id`, [target.candidateId, target.ownerId, target.revisionId, libraryRootId,
      prepared.runId, prepared.expectedLease.acquisitionId, target.libraryPath])).rowCount === 1;
  }
  async function insertEvent({ target, prepared, queryable }) {
    await insertImportCandidateEvent({ importCandidateId: target.candidateId,
      eventType: 'operator_track_receipt_invalidated_by_scan', previousStatus: 'applied', newStatus: 'applied',
      details: { runId: prepared.runId, ownerId: target.ownerId, receiptRevisionId: target.revisionId } }, queryable);
  }
  return { listForRoot, lockReceipt, recordMissing, insertEvent };
}
