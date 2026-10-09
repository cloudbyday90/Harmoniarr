/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';

export function createTestJobLease(jobType, runId) {
  return { leaseKey: `${jobType}:${runId}`, ownerInstanceId: 'test-worker', acquisitionId: randomUUID(),
    acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    state: 'active', status: 'active', releasedAt: null };
}
