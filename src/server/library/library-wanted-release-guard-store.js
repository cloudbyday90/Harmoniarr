/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { normalizeJobLease } from '../job-lease-store.js';
import { lockJobLeaseKey } from '../job-lease-lock-store.js';
import { writableExecutionRunSql } from '../import-candidates/import-execution-origin-sql.js';
import { lockLibraryRequestProjection } from './library-request-projection-lock-store.js';

export function createLibraryWantedReleaseGuardStore() {
  async function readRun({ prepared, queryable, lock = false }) {
    return (await queryable.query(`SELECT * FROM operation_runs
      WHERE id=$1::uuid AND operation_type=$2 AND ${writableExecutionRunSql('operation_runs')}
      ${lock ? 'FOR UPDATE' : ''}`, [prepared.runId, prepared.operationType])).rows[0] ?? null;
  }

  async function readContext({ prepared, queryable }) {
    if (prepared.mode === 'direct') return { run: null, lease: null };
    const run = await readRun({ prepared, queryable });
    const lease = normalizeJobLease((await queryable.query('SELECT * FROM job_leases WHERE lease_key=$1',
      [prepared.expectedLease.leaseKey])).rows[0]);
    return { run, lease };
  }

  async function lockContext({ prepared, queryable }) {
    if (prepared.mode === 'worker') {
      await readRun({ prepared, queryable, lock: true });
      await lockJobLeaseKey({ leaseKey: prepared.expectedLease.leaseKey, queryable });
    }
    await lockLibraryRequestProjection({ queryable });
    return readContext({ prepared, queryable });
  }

  async function readClock(queryable) {
    const value = (await queryable.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
    return value instanceof Date ? value.getTime() : Date.parse(value);
  }

  return { lockContext, readContext, readClock };
}
