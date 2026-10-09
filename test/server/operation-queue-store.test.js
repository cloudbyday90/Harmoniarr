/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { normalizeJobLease } from '../../src/server/job-lease-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';

test('operation queue store claims the next runnable run for the configured instance', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 1,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: '2026-05-01T02:05:00.000Z',
      claimed_by_instance_id: 'instance-a',
      error_message: null,
      finished_at: null,
      id: 'run-11',
      max_attempts: 2,
      next_attempt_at: '2026-05-01T02:00:00.000Z',
      operation_type: 'library_scan',
      started_at: '2026-05-01T01:55:00.000Z',
      status: 'pending',
      summary: { libraryRoot: 'D:/music' },
      triggered_by_user_id: 'admin-1',
    }],
  }));
  const operationQueueStore = createOperationQueueStore({
    claimOwnerInstanceId: 'instance-a',
    getPoolFn: () => ({ query }),
  });

  const run = await operationQueueStore.claimNextRunnableRun({
    operationTypes: ['library_scan', 'artwork_cleanup'],
  });

  assert.equal(query.mock.callCount(), 1);
  assert.match(query.mock.calls[0].arguments[0], /UPDATE operation_runs AS runs/);
  assert.match(query.mock.calls[0].arguments[0], /RETURNING\s+runs\.\*/);
  assert.match(query.mock.calls[0].arguments[0], /NOT EXISTS/);
  assert.match(query.mock.calls[0].arguments[0], /active_runs\.operation_type = operation_runs\.operation_type/);
  assert.match(query.mock.calls[0].arguments[0], /active_runs\.status = 'running'/);
  assert.match(query.mock.calls[0].arguments[0], /active_runs\.claimed_at > NOW\(\) - \(\$3 \* INTERVAL '1 millisecond'\)/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [['library_scan', 'artwork_cleanup'], 'instance-a', 60000]);
  assert.deepEqual(run, {
    attemptCount: 1,
    cancelRequestedAt: null,
    cancelRequestedByUserId: null,
    cancelledAt: null,
    claimedAt: '2026-05-01T02:05:00.000Z',
    claimedByInstanceId: 'instance-a',
    errorMessage: null,
    finishedAt: null,
    id: 'run-11',
    maxAttempts: 2,
    nextAttemptAt: '2026-05-01T02:00:00.000Z',
    operationType: 'library_scan',
    startedAt: '2026-05-01T01:55:00.000Z',
    status: 'pending',
    summary: { libraryRoot: 'D:/music' },
    triggeredByUserId: 'admin-1',
  });
});

test('operation queue store can reschedule a run for retry and clear stale terminal state', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 1,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      error_message: null,
      finished_at: null,
      id: 'run-12',
      max_attempts: 2,
      next_attempt_at: '2026-05-01T02:30:00.000Z',
      operation_type: 'artwork_cleanup',
      started_at: '2026-05-01T02:00:00.000Z',
      status: 'pending',
      summary: { requestedAssetCount: 9 },
      triggered_by_user_id: 'admin-3',
    }],
  }));
  const operationQueueStore = createOperationQueueStore({
    getPoolFn: () => ({ query }),
  });

  const run = await operationQueueStore.scheduleRetry({
    maxAttempts: 2,
    nextAttemptAt: '2026-05-01T02:30:00.000Z',
    runId: 'run-12',
  });

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['run-12', '2026-05-01T02:30:00.000Z', 2]);
  assert.equal(run.status, 'pending');
  assert.equal(run.maxAttempts, 2);
  assert.equal(run.nextAttemptAt, '2026-05-01T02:30:00.000Z');
});

test('operation queue store lists running runs for stranded-run recovery', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 2,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      error_message: null,
      finished_at: null,
      id: 'run-31',
      max_attempts: 3,
      next_attempt_at: '2026-05-01T03:00:00.000Z',
      operation_type: 'library_scan',
      started_at: '2026-05-01T02:00:00.000Z',
      status: 'running',
      summary: { libraryRoot: 'D:/music' },
      triggered_by_user_id: 'admin-1',
    }],
  }));
  const operationQueueStore = createOperationQueueStore({
    getPoolFn: () => ({ query }),
  });

  const runs = await operationQueueStore.listRecoverableRuns({
    limit: 50,
    operationTypes: ['library_scan'],
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], [['library_scan'], 50]);
  assert.equal(runs[0].status, 'running');
  assert.equal(runs[0].attemptCount, 2);
});


const recoveryClock = new Date('2026-10-09T21:00:00.000Z');
// Narrow SQL-response/state doubles prove transaction orchestration, not database locking.
function recoveryHarness(t, options = {}) {
  const initialRun = { id: randomUUID(), operation_type: 'artwork_cleanup', status: 'running', attempt_count: 2,
    max_attempts: 3, claimed_at: null, claimed_by_instance_id: null, summary: { requestedAssetCount: 9 },
    cancel_requested_at: null, started_at: new Date('2026-10-09T20:00:00.000Z'), ...options.run };
  const initialLease = options.missingLease ? null : { id: 'stable-row', job_type: initialRun.operation_type,
    lease_key: initialRun.operation_type + ':' + initialRun.id, owner_instance_id: 'pid:44', acquisition_id: randomUUID(),
    acquired_at: new Date('2026-10-09T20:59:00.000Z'), expires_at: new Date('2026-10-09T20:59:59.000Z'),
    released_at: null, status: 'active' };
  const observedRun = { id: initialRun.id, operationType: initialRun.operation_type, status: initialRun.status,
    attemptCount: initialRun.attempt_count, maxAttempts: initialRun.max_attempts,
    claimedAt: initialRun.claimed_at?.toISOString?.() ?? initialRun.claimed_at,
    claimedByInstanceId: initialRun.claimed_by_instance_id };
  const expectedLease = normalizeJobLease(initialLease, { now: recoveryClock });
  let committed = { run: initialRun, lease: initialLease };
  let working;
  const query = t.mock.fn(async (sql, params) => {
    if (sql === 'BEGIN') { working = structuredClone(committed); return { rows: [] }; }
    if (sql === 'COMMIT') { committed = working; working = null; return { rows: [] }; }
    if (sql === 'ROLLBACK') { working = null; return { rows: [] }; }
    if (sql.includes('SELECT pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('SELECT clock_timestamp()')) return { rows: [{ observed_at: options.clock ?? recoveryClock }] };
    if (sql.includes('FROM operation_runs') && sql.includes('FOR UPDATE')) {
      options.onLockedRun?.(working.run);
      const visible = !options.parentMissing && working.run.status === 'running'
        && !Object.hasOwn(working.run.summary, 'downloadPreparationClosure')
        && !Object.hasOwn(working.run.summary, 'downloadOriginSupersession');
      return { rows: visible ? [working.run] : [] };
    }
    if (sql.includes('FROM job_leases') && sql.includes('FOR UPDATE')) {
      options.onLockedLease?.(working);
      return { rows: working.lease ? [working.lease] : [] };
    }
    if (sql.includes('UPDATE job_leases')) {
      if (options.releaseFails) return { rows: [], rowCount: 0 };
      working.lease.released_at = recoveryClock;
      working.lease.status = 'expired';
      return { rows: [working.lease], rowCount: 1 };
    }
    if (sql.includes('UPDATE operation_runs')) {
      if (options.writeError) throw options.writeError;
      const retry = params.length === 4;
      const cancelled = working.run.cancel_requested_at != null;
      working.run.status = cancelled ? 'cancelled' : retry ? 'pending' : 'failed';
      working.run.summary = { ...working.run.summary, ...JSON.parse(params[1]),
        ...(cancelled ? { currentStep: 'Cancellation completed after stranded run recovery', retryScheduledAt: null } : {}) };
      working.run.claimed_at = null;
      working.run.claimed_by_instance_id = null;
      working.run.error_message = cancelled || retry ? null : params[2];
      if (retry && !cancelled) working.run.next_attempt_at = params[2];
      if (retry) working.run.max_attempts = params[3];
      return { rows: [working.run], rowCount: 1 };
    }
    assert.fail('Unexpected recovery query: ' + sql);
  });
  const client = { query, release: t.mock.fn() };
  const pool = { connect: t.mock.fn(async () => client), query: t.mock.fn(() => assert.fail('Recovery must stay on its transaction')) };
  const buildRetrySchedule = t.mock.fn(({ attemptCount, maxAttempts }) => attemptCount < maxAttempts
    ? { nextAttemptAt: '2026-10-09T21:00:30.000Z' } : null);
  const store = createOperationQueueStore({ getPoolFn: () => pool });
  const input = { observedRun, expectedLease, recoverySummary: { recoveryReason: expectedLease ? 'lease_expired' : 'lease_missing' },
    errorMessage: 'Worker lease unavailable', buildRetrySchedule };
  return { store, input, query, pool, client, buildRetrySchedule, get state() { return structuredClone(committed); } };
}

test('operation queue store atomically releases the observed expired acquisition and restores pending retry state', async (t) => {
  const h = recoveryHarness(t);
  const result = await h.store.recoverStrandedRun(h.input);
  assert.equal(result.status, 'pending');
  assert.equal(result.attemptCount, 2);
  assert.equal(result.maxAttempts, 3);
  assert.equal(result.nextAttemptAt, '2026-10-09T21:00:30.000Z');
  assert.equal(result.claimedAt, null);
  assert.deepEqual(h.buildRetrySchedule.mock.calls[0].arguments[0], { attemptCount: 2, maxAttempts: 3 });
  assert.equal(h.state.lease.released_at.getTime(), recoveryClock.getTime());
  assert.equal(h.state.lease.acquisition_id, h.input.expectedLease.acquisitionId);
  const writes = h.query.mock.calls.filter((call) => call.arguments[0].includes('UPDATE '));
  assert.equal(writes.length, 2);
  assert.equal(writes[0].arguments[1].at(-1), h.input.expectedLease.acquisitionId);
  assert.deepEqual(JSON.parse(writes[1].arguments[1][1]), { recoveryReason: 'lease_expired',
    currentStep: 'Automatic retry scheduled after stranded run recovery', lastFailureMessage: 'Worker lease unavailable',
    retryScheduledAt: '2026-10-09T21:00:30.000Z' });
  assert.equal(h.pool.connect.mock.callCount(), 1);
  assert.equal(h.pool.query.mock.callCount(), 0);
  assert.equal(h.client.release.mock.callCount(), 1);
});

test('exhausted work with an observed missing lease becomes failed without inventing a lease receipt', async (t) => {
  const h = recoveryHarness(t, { missingLease: true, run: { attempt_count: 3 } });
  const result = await h.store.recoverStrandedRun(h.input);
  assert.equal(result.status, 'failed');
  assert.equal(result.errorMessage, 'Worker lease unavailable');
  assert.equal(h.state.lease, null);
  assert.equal(h.query.mock.calls.some((call) => call.arguments[0].includes('UPDATE job_leases')), false);
});

for (const exhausted of [false, true]) {
  test('atomic recovery preserves current cancellation when retry budget ' + (exhausted ? 'is exhausted' : 'remains'), async (t) => {
    const h = recoveryHarness(t, { missingLease: true, run: { attempt_count: exhausted ? 3 : 1 },
      onLockedRun: (run) => { run.cancel_requested_at = recoveryClock; } });
    const result = await h.store.recoverStrandedRun(h.input);
    assert.equal(result.status, 'cancelled');
    assert.equal(result.errorMessage, null);
    assert.equal(result.summary.currentStep, 'Cancellation completed after stranded run recovery');
    assert.equal(result.summary.retryScheduledAt, null);
  });
}

test('stale claim/budget/acquisition or newly present missing lease cannot release or update a parent', async (t) => {
  for (const options of [
    { onLockedRun: (run) => { run.claimed_by_instance_id = 'new-worker'; } },
    { onLockedRun: (run) => { run.attempt_count += 1; } },
    { onLockedLease: (state) => { state.lease.acquisition_id = randomUUID(); } },
    { onLockedLease: (state) => { state.lease.expires_at = new Date(recoveryClock.getTime() + 60000); } },
    { missingLease: true, onLockedLease: (state) => { state.lease = { acquisition_id: randomUUID() }; } },
    { parentMissing: true },
    { onLockedRun: (run) => { run.summary.downloadPreparationClosure = null; } },
  ]) {
    const h = recoveryHarness(t, options);
    assert.equal(await h.store.recoverStrandedRun(h.input), null);
    assert.equal(h.query.mock.calls.some((call) => call.arguments[0].includes('UPDATE ')), false);
    assert.equal(h.buildRetrySchedule.mock.callCount(), 0);
  }
});

test('lease-release CAS refusal leaves parent and lease unchanged', async (t) => {
  const h = recoveryHarness(t, { releaseFails: true });
  const before = h.state;
  assert.equal(await h.store.recoverStrandedRun(h.input), null);
  assert.deepEqual(h.state, before);
  assert.equal(h.query.mock.calls.some((call) => call.arguments[0].includes('UPDATE operation_runs')), false);
});

test('a parent-write failure rolls back the earlier lease retirement in the same transaction', async (t) => {
  const failure = new Error('Controlled atomic recovery parent failure');
  const h = recoveryHarness(t, { writeError: failure });
  const before = h.state;
  await assert.rejects(h.store.recoverStrandedRun(h.input), (error) => error === failure);
  assert.deepEqual(h.state, before);
  assert.equal(h.query.mock.calls.some((call) => call.arguments[0] === 'ROLLBACK'), true);
  assert.equal(h.query.mock.calls.some((call) => call.arguments[0] === 'COMMIT'), false);
  assert.equal(h.client.release.mock.callCount(), 1);
});

test('malformed observed acquisition and invalid locked clock never authorize recovery writes', async (t) => {
  const h = recoveryHarness(t);
  h.input.expectedLease.acquisitionId = 'not-a-token';
  assert.equal(await h.store.recoverStrandedRun(h.input), null);
  assert.equal(h.pool.connect.mock.callCount(), 0);
  const invalidClock = recoveryHarness(t, { clock: 'invalid' });
  assert.equal(await invalidClock.store.recoverStrandedRun(invalidClock.input), null);
  assert.equal(invalidClock.query.mock.calls.some((call) => call.arguments[0].includes('UPDATE ')), false);
});
