/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createOperationStrandedRunRecoveryService } from '../../src/server/operation-stranded-run-recovery-service.js';

const detectedAt = '2026-10-09T21:00:00.000Z';
function harness(t, { missingLease = false, exhausted = false, active = false, outcome = null, stale = false,
  failure = null, empty = false } = {}) {
  const run = { id: randomUUID(), status: 'running', operationType: 'library_scan', attemptCount: exhausted ? 3 : 1,
    maxAttempts: 3, claimedAt: null, claimedByInstanceId: null };
  const lease = { leaseKey: run.operationType + ':' + run.id, ownerInstanceId: 'pid:44', acquisitionId: randomUUID(),
    acquiredAt: '2026-10-09T20:59:00.000Z', expiresAt: '2026-10-09T20:59:59.000Z',
    releasedAt: null, state: active ? 'active' : 'expired' };
  const buildRetrySchedule = t.mock.fn(({ attemptCount, maxAttempts }) => attemptCount < maxAttempts
    ? { delayMs: 30000, nextAttemptAt: '2026-10-09T21:00:30.000Z', scheduledAt: detectedAt } : null);
  const recoverStrandedRun = t.mock.fn(async (input) => {
    if (failure) throw failure;
    if (stale) return null;
    const schedule = input.buildRetrySchedule({ attemptCount: run.attemptCount, maxAttempts: run.maxAttempts });
    return { id: run.id, status: outcome ?? (schedule ? 'pending' : 'failed') };
  });
  const releaseLease = t.mock.fn(() => assert.fail('The atomic owner must release its captured lease'));
  const getLease = t.mock.fn(() => assert.fail('A delayed observation must not acquire the newest token'));
  const listLeases = t.mock.fn(async () => missingLease ? [] : [lease]);
  const service = createOperationStrandedRunRecoveryService({
    jobLeaseStore: { listLeases, releaseLease, getLease },
    operationQueueStore: { listRecoverableRuns: async () => empty ? [] : [run], recoverStrandedRun },
    retryPolicyService: { buildRetrySchedule }, nowFn: () => new Date(detectedAt),
  });
  return { service, run, lease, recoverStrandedRun, listLeases, releaseLease, getLease, buildRetrySchedule };
}
const counts = (overrides = {}) => ({ activeLeaseCount: 0, cancelledCount: 0, failedCount: 0,
  retriedCount: 0, scannedCount: 1, skipped: false, ...overrides });

test('operation stranded recovery forwards the exact expired observation to one atomic retry owner', async (t) => {
  const h = harness(t);
  assert.deepEqual(await h.service.recoverStrandedRuns({ operationTypes: ['library_scan'] }), counts({ retriedCount: 1 }));
  assert.deepEqual(h.recoverStrandedRun.mock.calls[0].arguments[0], {
    observedRun: h.run, expectedLease: h.lease, recoverySummary: { recoveryDetectedAt: detectedAt, recoveryReason: 'lease_expired' },
    errorMessage: 'Worker lease expired during stranded run recovery', buildRetrySchedule: h.buildRetrySchedule });
  assert.equal(h.recoverStrandedRun.mock.callCount(), 1);
  assert.equal(h.releaseLease.mock.callCount(), 0);
  assert.equal(h.getLease.mock.callCount(), 0);
  assert.deepEqual(h.buildRetrySchedule.mock.calls[0].arguments[0], { attemptCount: 1, maxAttempts: 3 });
});

test('operation stranded recovery reports the atomic exhausted missing-lease failure', async (t) => {
  const h = harness(t, { missingLease: true, exhausted: true });
  assert.deepEqual(await h.service.recoverStrandedRuns(), counts({ failedCount: 1 }));
  const input = h.recoverStrandedRun.mock.calls[0].arguments[0];
  assert.equal(input.expectedLease, null);
  assert.equal(input.errorMessage, 'Worker lease was missing during stranded run recovery');
  assert.deepEqual(input.recoverySummary, { recoveryDetectedAt: detectedAt, recoveryReason: 'lease_missing' });
  assert.deepEqual(h.buildRetrySchedule.mock.calls[0].arguments[0], { attemptCount: 3, maxAttempts: 3 });
  assert.equal(h.releaseLease.mock.callCount(), 0);
});

for (const exhausted of [false, true]) {
  test('stranded recovery counts persisted cancellation when retry budget ' + (exhausted ? 'is exhausted' : 'remains'), async (t) => {
    const h = harness(t, { missingLease: true, exhausted, outcome: 'cancelled' });
    assert.deepEqual(await h.service.recoverStrandedRuns(), counts({ cancelledCount: 1 }));
    assert.equal(h.recoverStrandedRun.mock.callCount(), 1);
    assert.equal(h.releaseLease.mock.callCount(), 0);
    assert.equal(h.buildRetrySchedule.mock.callCount(), 1);
  });
}

test('an active observed lease is skipped without invoking any recovery mutation', async (t) => {
  const h = harness(t, { active: true });
  assert.deepEqual(await h.service.recoverStrandedRuns(), counts({ activeLeaseCount: 1 }));
  assert.equal(h.recoverStrandedRun.mock.callCount(), 0);
  assert.equal(h.releaseLease.mock.callCount(), 0);
});

test('a stale atomic refusal is not reported as retry/failure/cancellation or retried using a latest token', async (t) => {
  const h = harness(t, { stale: true });
  const original = structuredClone(h.lease);
  assert.deepEqual(await h.service.recoverStrandedRuns(), counts());
  assert.deepEqual(h.recoverStrandedRun.mock.calls[0].arguments[0].expectedLease, original);
  assert.equal(h.recoverStrandedRun.mock.callCount(), 1);
  assert.equal(h.buildRetrySchedule.mock.callCount(), 0);
  assert.equal(h.getLease.mock.callCount(), 0);
  assert.equal(h.releaseLease.mock.callCount(), 0);
});

test('empty recovery inventory performs no lease read or mutation', async (t) => {
  const h = harness(t, { empty: true });
  assert.deepEqual(await h.service.recoverStrandedRuns(), counts({ scannedCount: 0, skipped: true }));
  assert.equal(h.listLeases.mock.callCount(), 0);
  assert.equal(h.recoverStrandedRun.mock.callCount(), 0);
});

test('atomic owner errors propagate without key-only cleanup or false success reporting', async (t) => {
  const failure = new Error('Controlled atomic owner failure');
  const h = harness(t, { failure });
  await assert.rejects(h.service.recoverStrandedRuns(), (error) => error === failure);
  assert.equal(h.recoverStrandedRun.mock.callCount(), 1);
  assert.equal(h.releaseLease.mock.callCount(), 0);
  assert.equal(h.getLease.mock.callCount(), 0);
});
