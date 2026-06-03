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

// Read-only collusion report service. Pulls shared confirmed-transcode
// fingerprints from the spectral job store and runs them through the pure
// union-find detector. Fail-safe: a query error yields an empty report rather
// than throwing into a route handler.

import { detectCollusionRings } from './source-user-collusion-detector.js';

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * @param {object} deps
 * @param {(input: { minDistinctUsers: number, limit: number }) => Promise<Array<object>>} deps.listSharedTranscodeFingerprintsFn
 * @param {Function} [deps.detectCollusionRingsFn]
 * @param {number} [deps.minDistinctUsers]
 * @param {number} [deps.fingerprintLimit]
 * @param {(message: string, error?: Error) => void} [deps.onWarning]
 */
export function createSourceUserCollusionService({
  listSharedTranscodeFingerprintsFn,
  detectCollusionRingsFn = detectCollusionRings,
  minDistinctUsers = 2,
  fingerprintLimit = 200,
  onWarning = () => {},
} = {}) {
  if (typeof listSharedTranscodeFingerprintsFn !== 'function') {
    throw new Error('createSourceUserCollusionService requires listSharedTranscodeFingerprintsFn');
  }

  const baseMinUsers = Math.max(2, normalizePositiveInteger(minDistinctUsers, 2));
  const baseLimit = normalizePositiveInteger(fingerprintLimit, 200);

  async function getCollusionReport({ minDistinctUsers: minUsersInput, limit: limitInput } = {}) {
    const minUsers = Math.max(2, normalizePositiveInteger(minUsersInput, baseMinUsers));
    const limit = normalizePositiveInteger(limitInput, baseLimit);

    let sharedFingerprints;
    try {
      sharedFingerprints = await listSharedTranscodeFingerprintsFn({ minDistinctUsers: minUsers, limit });
    } catch (error) {
      onWarning('Failed to load shared transcode fingerprints', error);
      sharedFingerprints = [];
    }

    const report = detectCollusionRingsFn({ sharedFingerprints, minRingSize: minUsers });

    return {
      checkedAt: new Date().toISOString(),
      minDistinctUsers: minUsers,
      ...report,
    };
  }

  return { getCollusionReport };
}
