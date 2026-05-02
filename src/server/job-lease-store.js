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
} = {}) {
  const resolvedLeaseDurationMs = normalizeLeaseDurationMs(leaseDurationMs);

  async function acquireLease({ jobType, leaseKey }) {
    const result = await getPoolFn().query(
      `
        INSERT INTO job_leases (
          job_type,
          lease_key,
          owner_instance_id,
          acquired_at,
          heartbeat_at,
          expires_at,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          NOW(),
          NOW(),
          NOW() + ($4 * INTERVAL '1 millisecond'),
          'active'
        )
        RETURNING id, job_type, lease_key, owner_instance_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
      `,
      [jobType, leaseKey, ownerInstanceId, resolvedLeaseDurationMs],
    );

    return normalizeJobLease(result.rows[0], { now: nowFn() });
  }

  async function getLease({ leaseKey }) {
    const result = await getPoolFn().query(
      `
        SELECT id, job_type, lease_key, owner_instance_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
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
        SELECT id, job_type, lease_key, owner_instance_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
        FROM job_leases
        WHERE lease_key = ANY($1::text[])
      `,
      [leaseKeys],
    );

    return result.rows.map((row) => normalizeJobLease(row, { now: nowFn() }));
  }

  async function renewLease({ leaseKey, status = 'active' }) {
    const result = await getPoolFn().query(
      `
        UPDATE job_leases
        SET heartbeat_at = NOW(),
            expires_at = NOW() + ($2 * INTERVAL '1 millisecond'),
            status = $3
        WHERE lease_key = $1
          AND released_at IS NULL
        RETURNING id, job_type, lease_key, owner_instance_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
      `,
      [leaseKey, resolvedLeaseDurationMs, status],
    );

    return normalizeJobLease(result.rows[0], { now: nowFn() });
  }

  async function releaseLease({ leaseKey, status }) {
    const result = await getPoolFn().query(
      `
        UPDATE job_leases
        SET released_at = NOW(),
            heartbeat_at = NOW(),
            status = $2
        WHERE lease_key = $1
          AND released_at IS NULL
        RETURNING id, job_type, lease_key, owner_instance_id, acquired_at, heartbeat_at, expires_at, released_at, status, created_at
      `,
      [leaseKey, status],
    );

    return normalizeJobLease(result.rows[0], { now: nowFn() });
  }

  return {
    acquireLease,
    getLease,
    listLeases,
    releaseLease,
    renewLease,
  };
}