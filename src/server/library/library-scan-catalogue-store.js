/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { normalizeJobLease } from '../job-lease-store.js';
import { lockJobLeaseKey } from '../job-lease-lock-store.js';
import { writableExecutionRunSql } from '../import-candidates/import-execution-origin-sql.js';

export function createLibraryScanCatalogueStore() {
  async function readRun(prepared, queryable, lock = false) {
    return (await queryable.query(`
      SELECT * FROM operation_runs
      WHERE id = $1::uuid AND operation_type = 'library_scan'
        AND ${writableExecutionRunSql('operation_runs')}
      ${lock ? 'FOR UPDATE' : ''}
    `, [prepared.runId])).rows[0] ?? null;
  }

  async function lockContext({ prepared, queryable }) {
    const run = await readRun(prepared, queryable, true);
    const lease = normalizeJobLease(await lockJobLeaseKey({
      leaseKey: prepared.expectedLease.leaseKey,
      queryable,
    }));
    // Match catalogue and organize writers: lock the root before any files.
    const root = (await queryable.query(`
      SELECT id, canonical_path FROM library_roots
      WHERE canonical_path = $1
      FOR UPDATE
    `, [prepared.libraryRootPath])).rows[0];
    return { run, lease, root: root ? { id: root.id, canonicalPath: root.canonical_path } : null };
  }

  async function readContext({ prepared, queryable }) {
    const run = await readRun(prepared, queryable);
    const lease = normalizeJobLease((await queryable.query(
      'SELECT * FROM job_leases WHERE lease_key = $1', [prepared.expectedLease.leaseKey],
    )).rows[0]);
    return { run, lease };
  }

  async function readClock(queryable) {
    const value = (await queryable.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
    return value instanceof Date ? value.getTime() : Date.parse(value);
  }

  return { lockContext, readContext, readClock };
}
