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

import { getPool } from './database.js';
import { normalizeExpectedJobLease } from './job-lease-policy.js';
import { createDatabaseTransactionRunner } from './database-transaction-service.js';
import { lockJobLeaseKey } from './job-lease-lock-store.js';

const defaultLeaseDurationMs = 30 * 60 * 1000;

function toIsoString(value) {
  return value?.toISOString?.() ?? value ?? null;
}

function normalizeLeaseDurationMs(leaseDurationMs) {
  const parsed = Number.parseInt(leaseDurationMs, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultLeaseDurationMs;
  }

  return Math.min(parsed, 24 * 60 * 60 * 1000);
}

function buildDefaultOwnerInstanceId() {
  return process.env.HARMONIARR_INSTANCE_ID ?? `pid:${process.pid}`;
}

export function buildJobLeaseKey({ jobType, runId }) {
  return `${jobType}:${runId}`;
}

export function normalizeJobLease(row, { now = new Date() } = {}) {
  if (!row) {
    return null;
  }

  const releasedAt = row.released_at ?? null;
  const expiresAt = row.expires_at ?? null;
  const isExpired = !releasedAt && expiresAt instanceof Date
    ? expiresAt.getTime() <= now.getTime()
    : Boolean(!releasedAt && expiresAt && new Date(expiresAt).getTime() <= now.getTime());

  return {
    ...(row.acquisition_id != null ? { acquisitionId: row.acquisition_id } : {}),
    acquiredAt: toIsoString(row.acquired_at),
    createdAt: toIsoString(row.created_at),
    expiresAt: toIsoString(expiresAt),
    heartbeatAt: toIsoString(row.heartbeat_at),
    id: row.id,
    jobType: row.job_type,
    leaseKey: row.lease_key,
    ownerInstanceId: row.owner_instance_id,
    releasedAt: toIsoString(releasedAt),
    state: releasedAt ? 'released' : (isExpired ? 'expired' : 'active'),
    status: row.status,
  };
}

export function createJobLeaseStore({
  getPoolFn = getPool,
  leaseDurationMs = defaultLeaseDurationMs,
  nowFn = () => new Date(),
  ownerInstanceId = buildDefaultOwnerInstanceId(),
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }),
} = {}) {
  const resolvedLeaseDurationMs = normalizeLeaseDurationMs(leaseDurationMs);

  async function acquireLease({ jobType, leaseKey, queryable = null }) {
    const write = async (client) => {
      await lockJobLeaseKey({ leaseKey, queryable: client });
      const result = await client.query(
        `
        INSERT INTO job_leases (
          job_type,
          lease_key,
          owner_instance_id,
          acquisition_id,
          acquired_at,
          heartbeat_at,
          expires_at,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          gen_random_uuid(),
          clock_timestamp(),
          clock_timestamp(),
          clock_timestamp() + ($4 * INTERVAL '1 millisecond'),
          'active'
        )
        ON CONFLICT (lease_key) DO UPDATE
        SET owner_instance_id = EXCLUDED.owner_instance_id,
            acquisition_id = EXCLUDED.acquisition_id,
            acquired_at = clock_timestamp(),
            heartbeat_at = clock_timestamp(),
            expires_at = clock_timestamp() + ($4 * INTERVAL '1 millisecond'),
            released_at = NULL,
            status = 'active'
        WHERE job_leases.released_at IS NOT NULL
           OR job_leases.expires_at <= clock_timestamp()
        RETURNING id, job_type, lease_key, owner_instance_id, acquisition_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
      `,
        [jobType, leaseKey, ownerInstanceId, resolvedLeaseDurationMs],
      );

      return normalizeJobLease(result.rows[0], { now: nowFn() });
    };
    return queryable ? write(queryable) : withTransaction(write);
  }

  async function getLease({ leaseKey }) {
    const result = await getPoolFn().query(
      `
        SELECT id, job_type, lease_key, owner_instance_id, acquisition_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
        FROM job_leases
        WHERE lease_key = $1
        LIMIT 1
      `,
      [leaseKey],
    );

    return normalizeJobLease(result.rows[0], { now: nowFn() });
  }

  async function listLeases({ leaseKeys } = {}) {
    if (!Array.isArray(leaseKeys) || leaseKeys.length === 0) {
      return [];
    }

    const result = await getPoolFn().query(
      `
        SELECT id, job_type, lease_key, owner_instance_id, acquisition_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
        FROM job_leases
        WHERE lease_key = ANY($1::text[])
      `,
      [leaseKeys],
    );

    return result.rows.map((row) => normalizeJobLease(row, { now: nowFn() }));
  }

  async function renewLease({ leaseKey, expectedLease, status = 'active', queryable = null }) {
    const expected = normalizeExpectedJobLease(expectedLease, { leaseKey });
    if (!expected) return null;
    const write = async (client) => {
      await lockJobLeaseKey({ leaseKey, queryable: client });
      const result = await client.query(
        `
        UPDATE job_leases
        SET heartbeat_at = clock_timestamp(),
            expires_at = clock_timestamp() + ($2 * INTERVAL '1 millisecond'),
            status = $3
        WHERE lease_key = $1
          AND released_at IS NULL
          AND owner_instance_id = $4 AND acquisition_id = $5::uuid
          AND expires_at > clock_timestamp()
        RETURNING id, job_type, lease_key, owner_instance_id, acquisition_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
      `,
        [leaseKey, resolvedLeaseDurationMs, status, expected.ownerInstanceId, expected.acquisitionId],
      );

      return normalizeJobLease(result.rows[0], { now: nowFn() });
    };
    return queryable ? write(queryable) : withTransaction(write);
  }

  async function releaseLease({ leaseKey, expectedLease, status, queryable = null }) {
    const expected = normalizeExpectedJobLease(expectedLease, { leaseKey });
    if (!expected) return null;
    const write = async (client) => {
      await lockJobLeaseKey({ leaseKey, queryable: client });
      const result = await client.query(
        `
        UPDATE job_leases
        SET released_at = clock_timestamp(),
            heartbeat_at = clock_timestamp(),
            status = $2
        WHERE lease_key = $1
          AND released_at IS NULL
          AND owner_instance_id = $3 AND acquisition_id = $4::uuid
        RETURNING id, job_type, lease_key, owner_instance_id, acquisition_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
      `,
        [leaseKey, status, expected.ownerInstanceId, expected.acquisitionId],
      );

      return normalizeJobLease(result.rows[0], { now: nowFn() });
    };
    return queryable ? write(queryable) : withTransaction(write);
  }

  return {
    acquireLease,
    getLease,
    listLeases,
    releaseLease,
    renewLease,
  };
}
