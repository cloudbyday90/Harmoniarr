/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { normalizeJobLease } from '../job-lease-store.js';
import { lockJobLeaseKey } from '../job-lease-lock-store.js';
import { writableExecutionRunSql } from '../import-candidates/import-execution-origin-sql.js';

export function createLibraryOrganizeMutationStore() {
  async function lockContext({ prepared, queryable }) {
    const run = (await queryable.query(`
      SELECT * FROM operation_runs
      WHERE id = $1::uuid AND operation_type = 'library_organize_apply'
        AND ${writableExecutionRunSql('operation_runs')}
      FOR UPDATE
    `, [prepared.runId])).rows[0] ?? null;
    const lease = normalizeJobLease(await lockJobLeaseKey({
      leaseKey: prepared.expectedLease.leaseKey,
      queryable,
    }));
    // The catalogue writer locks its root before files. Keep the same order
    // explicitly instead of relying on joined row-mark acquisition order.
    const root = (await queryable.query(`
      SELECT canonical_path FROM library_roots
      WHERE id = $1::uuid
      FOR UPDATE
    `, [prepared.file.libraryRootId])).rows[0];
    const row = (await queryable.query(`
      SELECT id, library_root_id, canonical_path, file_state, deleted_at
      FROM library_files
      WHERE id = $1::uuid AND library_root_id = $2::uuid
      FOR UPDATE
    `, [prepared.file.fileId, prepared.file.libraryRootId])).rows[0];
    return {
      run,
      lease,
      file: row ? {
        id: row.id,
        libraryRootId: row.library_root_id,
        canonicalPath: row.canonical_path,
        fileState: row.file_state,
        deletedAt: row.deleted_at,
        rootPath: root?.canonical_path ?? null,
      } : null,
    };
  }

  async function readClock(queryable) {
    const value = (await queryable.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
    return value instanceof Date ? value.getTime() : Date.parse(value);
  }

  async function updateCanonicalPath({ context, prepared, queryable }) {
    const result = await queryable.query(`
      UPDATE library_files
      SET canonical_path = $2, relative_path = $3, filename = $4, updated_at = clock_timestamp()
      WHERE id = $1::uuid AND canonical_path = $5 AND library_root_id = $6::uuid
        AND deleted_at IS NULL AND file_state = 'observed'
        AND EXISTS (
          SELECT 1 FROM job_leases
          WHERE lease_key = $7 AND acquisition_id = $8::uuid AND owner_instance_id = $9
            AND released_at IS NULL AND expires_at > clock_timestamp()
        )
        AND EXISTS (
          SELECT 1 FROM operation_runs
          WHERE id = $10::uuid AND operation_type = 'library_organize_apply'
            AND status = 'running' AND cancel_requested_at IS NULL AND cancelled_at IS NULL
        )
      RETURNING id
    `, [
      prepared.file.fileId,
      prepared.file.proposedPath,
      prepared.file.proposedRelativePath,
      prepared.file.filename,
      context.file.canonicalPath,
      prepared.file.libraryRootId,
      prepared.expectedLease.leaseKey,
      prepared.expectedLease.acquisitionId,
      prepared.expectedLease.ownerInstanceId,
      prepared.runId,
    ]);
    return result.rowCount === 1;
  }

  return { lockContext, readClock, updateCanonicalPath };
}
