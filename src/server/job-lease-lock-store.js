/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Fence absent keys as well as existing rows; all cooperating owners use this order. */
export async function lockJobLeaseKey({ leaseKey, queryable }) {
  await queryable.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`harmoniarr.job-lease:${leaseKey}`]);
  return (await queryable.query('SELECT * FROM job_leases WHERE lease_key=$1 FOR UPDATE', [leaseKey])).rows[0] ?? null;
}
