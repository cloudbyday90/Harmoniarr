/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

const plain = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && !value.includes('\u0000');
const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const iso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** Capture acquisition authority once; a key, PID or timestamp alone is insufficient. */
export function normalizeExpectedJobLease(expectedLease, { leaseKey = expectedLease?.leaseKey } = {}) {
  if (!plain(expectedLease) || !text(leaseKey) || expectedLease.leaseKey !== leaseKey
    || !text(expectedLease.ownerInstanceId) || !uuid(expectedLease.acquisitionId)) return null;
  return Object.freeze({ leaseKey, ownerInstanceId: expectedLease.ownerInstanceId, acquisitionId: expectedLease.acquisitionId });
}

export function isCurrentJobLeaseAcquisition(current, expected, { leaseKey = expected?.leaseKey,
  now = Date.now(), allowExpired = false } = {}) {
  const identity = normalizeExpectedJobLease(expected, { leaseKey });
  const actual = normalizeExpectedJobLease(current, { leaseKey });
  return identity != null && actual != null && actual.ownerInstanceId === identity.ownerInstanceId
    && actual.acquisitionId === identity.acquisitionId && current.releasedAt == null
    && iso(current.expiresAt) && Number.isFinite(now)
    && (allowExpired === true || Date.parse(current.expiresAt) > now);
}
