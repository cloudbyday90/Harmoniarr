/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export function createOperationRunLeaseFixture({ runId, jobType, acquisitionId = '10000000-0000-4000-8000-000000000001' }) {
  return { id: 'stable-lease-row', jobType, leaseKey: `${jobType}:${runId}`, ownerInstanceId: 'test-worker', acquisitionId,
    acquiredAt: '2026-10-09T00:00:00.000Z', expiresAt: '2099-10-09T00:00:00.000Z', releasedAt: null, state: 'active', status: 'active' };
}
