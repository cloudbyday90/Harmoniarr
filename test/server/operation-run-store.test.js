/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';

const bridgeNow = new Date('2026-10-09T21:00:00.000Z');
function ownedPool(t, { runId, operationType = 'library_scan', attemptCount = 1, maxAttempts = 3,
  parentAvailable = true, leaseChanges = {}, writeResult = true, writeError = null } = {}) {
  const expectedLease = { leaseKey: operationType + ':' + runId, ownerInstanceId: 'pid:44', acquisitionId: randomUUID() };
  const run = { id: runId, operation_type: operationType, status: 'running', summary: {}, attempt_count: attemptCount,
    max_attempts: maxAttempts, claimed_at: null, claimed_by_instance_id: null, cancel_requested_at: null };
  const lease = { lease_key: expectedLease.leaseKey, owner_instance_id: expectedLease.ownerInstanceId,
    acquisition_id: expectedLease.acquisitionId, acquired_at: bridgeNow, expires_at: new Date(bridgeNow.getTime() + 60000),
    released_at: null, ...leaseChanges };
  const query = t.mock.fn(async (sql) => {
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    if (sql.includes('SELECT pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('SELECT clock_timestamp()')) return { rows: [{ observed_at: bridgeNow }] };
    if (sql.includes('FROM job_leases') && sql.includes('FOR UPDATE')) return { rows: [lease] };
    if (sql.includes('FROM operation_runs') && sql.includes('FOR UPDATE')) {
      return { rows: parentAvailable ? [run] : [], rowCount: parentAvailable ? 1 : 0 };
    }
    if (sql.includes('UPDATE operation_runs')) {
      if (writeError) throw writeError;
      return { rows: writeResult ? [{ id: runId }] : [], rowCount: writeResult ? 1 : 0 };
    }
    assert.fail('Unexpected transactional query: ' + sql);
  });
  const release = t.mock.fn();
  const client = { query, release };
  const pool = { connect: t.mock.fn(async () => client), query: t.mock.fn(async (sql) => {
    if (sql.includes('SELECT cancel_requested_at')) return { rows: [{ cancel_requested_at: bridgeNow }] };
    assert.fail('Owned lifecycle must use its transaction client');
  }) };
  return { pool, client, query, expectedLease,
    writes: () => query.mock.calls.filter((call) => call.arguments[0].includes('UPDATE operation_runs')) };
}

test('transaction cancellation checks do not borrow another pool connection', async (t) => {
  const queryable = { query: t.mock.fn(async () => ({ rows: [{ cancel_requested_at: '2026-09-10T00:00:00Z' }] })) };
  const store = createOperationRunStore({ getPoolFn: () => assert.fail('Cancellation guard must remain on its transaction'), operationType: 'library_external_request_discovery' });
  assert.equal(await store.isCancellationRequested({ runId: 'run', queryable }), true);
  assert.deepEqual(queryable.query.mock.calls[0].arguments[1], ['run', 'library_external_request_discovery']);
});

test('operation run creation stays in the supplied transaction without borrowing a pool connection', async (t) => {
  const queryable = {
    query: t.mock.fn(async (_sql, params) => ({
      rows: [{
        id: 'transaction-run',
        operation_type: params[0],
        status: params[1],
        summary: JSON.parse(params[3]),
        max_attempts: params[5],
      }],
    })),
  };
  const store = createOperationRunStore({
    getPoolFn: () => assert.fail('Transactional enqueue must not use the pool'),
    operationType: 'library_external_intake_planning',
  });

  const run = await store.createOperationRun({
    maxAttempts: 3,
    queryable,
    summary: { mediaRequestId: 'request-1' },
    triggeredByUserId: 'admin',
  });

  assert.equal(queryable.query.mock.callCount(), 1);
  assert.equal(run.id, 'transaction-run');
  assert.equal(run.status, 'pending');
  assert.equal(run.maxAttempts, 3);
  assert.deepEqual(run.summary, { mediaRequestId: 'request-1' });
});

test('operation run store delegates the captured acquisition through its locked admission and lease bridge', async (t) => {
  const h = ownedPool(t, { runId: 'run-5' });
  const acquired = { ...h.expectedLease };
  const newer = { ...acquired, acquisitionId: randomUUID() };
  const acquireLease = t.mock.fn(async () => acquired);
  const getLease = t.mock.fn(async () => newer);
  const releaseLease = t.mock.fn(async () => acquired);
  const renewLease = t.mock.fn(async () => acquired);
  const createJobLeaseStoreFn = t.mock.fn(() => ({ acquireLease, getLease, releaseLease, renewLease }));
  const store = createOperationRunStore({ createJobLeaseStoreFn, getPoolFn: () => h.pool, operationType: 'library_scan' });
  const captured = await store.acquireLease({ runId: 'run-5' });
  await store.renewLease({ runId: 'run-5', expectedLease: captured, status: 'running' });
  assert.equal((await store.getLease({ runId: 'run-5' })).acquisitionId, newer.acquisitionId);
  await store.releaseLease({ runId: 'run-5', expectedLease: captured, status: 'completed' });
  assert.equal(createJobLeaseStoreFn.mock.callCount(), 1);
  assert.deepEqual(acquireLease.mock.calls[0].arguments[0], { jobType: 'library_scan', leaseKey: 'library_scan:run-5', queryable: h.client });
  assert.deepEqual(renewLease.mock.calls[0].arguments[0], { leaseKey: 'library_scan:run-5', expectedLease: acquired, status: 'running' });
  assert.deepEqual(releaseLease.mock.calls[0].arguments[0], { leaseKey: 'library_scan:run-5', expectedLease: acquired, status: 'completed' });
  assert.deepEqual(getLease.mock.calls[0].arguments[0], { leaseKey: 'library_scan:run-5' });
  assert.equal(h.pool.connect.mock.callCount(), 1);
});

test('operation run store rejects unavailable shared leases after owned run admission', async (t) => {
  const h = ownedPool(t, { runId: 'run-busy' });
  const store = createOperationRunStore({ getPoolFn: () => h.pool, operationType: 'library_scan',
    createJobLeaseStoreFn: () => ({ acquireLease: async () => null }) });
  await assert.rejects(store.acquireLease({ runId: 'run-busy' }), {
    code: 'operation_run_lease_unavailable', message: 'Operation run lease is currently held by another worker', runId: 'run-busy' });
  assert.equal(h.pool.connect.mock.callCount(), 1);
  assert.equal(h.writes().length, 0);
});

test('operation run store can check and finalize shared cancellation with its captured acquisition', async (t) => {
  const h = ownedPool(t, { runId: 'run-19' });
  const store = createOperationRunStore({ getPoolFn: () => h.pool, operationType: 'library_scan' });
  assert.equal(await store.isCancellationRequested({ runId: 'run-19' }), true);
  assert.equal(await store.markRunCancelled({ runId: 'run-19', expectedLease: h.expectedLease,
    summary: { currentStep: 'Cancelled by operator' } }), true);
  assert.deepEqual(h.pool.query.mock.calls[0].arguments[1], ['run-19', 'library_scan']);
  const [sql, params] = h.writes()[0].arguments;
  assert.equal(params[0], 'run-19');
  assert.deepEqual(JSON.parse(params[1]), { currentStep: 'Cancelled by operator' });
  assert.deepEqual(params.slice(4), [h.expectedLease.acquisitionId, h.expectedLease.ownerInstanceId, h.expectedLease.leaseKey]);
  assert.match(sql, /status='cancelled'/u);
  assert.equal(h.query.mock.calls.some((call) => call.arguments[0].includes('DELETE FROM operation_runs')), false);
});

test('operation run store persists queue retry metadata when creating a run', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 0,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      error_message: null,
      finished_at: null,
      id: 'run-44',
      max_attempts: 3,
      next_attempt_at: '2026-05-01T04:00:00.000Z',
      started_at: '2026-05-01T03:59:00.000Z',
      status: 'pending',
      summary: { libraryRoot: 'D:/library' },
    }],
  }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  const run = await operationRunStore.createOperationRun({
    maxAttempts: 3,
    nextAttemptAt: '2026-05-01T04:00:00.000Z',
    summary: { libraryRoot: 'D:/library' },
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'library_scan',
    'pending',
    null,
    JSON.stringify({ libraryRoot: 'D:/library' }),
    '2026-05-01T04:00:00.000Z',
    3,
  ]);
  assert.equal(run.maxAttempts, 3);
  assert.equal(run.nextAttemptAt, '2026-05-01T04:00:00.000Z');
  assert.equal(run.attemptCount, 0);
});

test('operation run store reschedules failure using the locked retry budget and captured acquisition', async (t) => {
  const h = ownedPool(t, { runId: 'run-71' });
  const buildRetrySchedule = t.mock.fn(() => ({ delayMs: 30000, nextAttemptAt: '2026-05-01T00:00:30.000Z',
    scheduledAt: '2026-05-01T00:00:00.000Z' }));
  const store = createOperationRunStore({ getPoolFn: () => h.pool, operationType: 'library_scan',
    retryPolicyService: { buildRetrySchedule } });
  assert.equal(await store.markRunFailed({ errorMessage: 'transient scan failure', runId: 'run-71',
    expectedLease: h.expectedLease, summary: { libraryRoot: 'D:/music' } }), true);
  assert.deepEqual(buildRetrySchedule.mock.calls[0].arguments[0], { attemptCount: 1, maxAttempts: 3 });
  const [sql, params] = h.writes()[0].arguments;
  assert.equal(params[0], 'run-71');
  assert.deepEqual(JSON.parse(params[1]), { currentStep: 'Automatic retry scheduled after failed attempt',
    lastFailureMessage: 'transient scan failure', libraryRoot: 'D:/music', retryScheduledAt: '2026-05-01T00:00:30.000Z' });
  assert.equal(params[3], '2026-05-01T00:00:30.000Z');
  assert.match(sql, /status='pending'/u);
  assert.equal(h.pool.query.mock.callCount(), 0);
});

test('operation run store requeues an owned pause without consuming retry budget', async (t) => {
  const h = ownedPool(t, { runId: 'run-81' });
  const store = createOperationRunStore({ getPoolFn: () => h.pool, operationType: 'library_scan' });
  assert.equal(await store.markRunPaused({ runId: 'run-81', expectedLease: h.expectedLease,
    nextAttemptAt: '2026-05-04T12:30:00.000Z',
    summary: { currentStep: 'Library scan paused by maintenance lock', pauseCode: 'recovery_lock_conflict' } }), true);
  const [sql, params] = h.writes()[0].arguments;
  assert.equal(params[0], 'run-81');
  assert.equal(params[3], '2026-05-04T12:30:00.000Z');
  assert.deepEqual(JSON.parse(params[1]), { currentStep: 'Library scan paused by maintenance lock', pauseCode: 'recovery_lock_conflict' });
  assert.match(sql, /attempt_count=GREATEST\(attempt_count-1,0\)/u);
  assert.match(sql, /status IN \('pending','running'\)/u);
});

test('operation run store pruneOldRuns deletes finished runs beyond the retain count', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.pruneOldRuns({ retainCount: 10 });

  assert.equal(query.mock.callCount(), 1);
  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM operation_runs/);
  assert.match(sql, /status IN \('completed', 'failed', 'cancelled'\)/);
  assert.match(sql, /LIMIT \$2/);
  assert.deepEqual(params, ['library_scan', 10]);
});

test('operation run store pruneOldRuns uses default retain count of 20 when none supplied', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.pruneOldRuns();

  assert.deepEqual(query.mock.calls[0].arguments[1], ['library_scan', 20]);
});

test('operation run store pruneOldRuns clamps retainCount to at least 1', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.pruneOldRuns({ retainCount: 0 });

  assert.deepEqual(query.mock.calls[0].arguments[1], ['library_scan', 1]);
});

test('operation run store pruneOldRuns clamps retainCount to at most 1000', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.pruneOldRuns({ retainCount: 9999 });

  assert.deepEqual(query.mock.calls[0].arguments[1], ['library_scan', 1000]);
});
test('missing/stale/expired/closed ownership cannot write any leased lifecycle state', async (t) => {
  for (const kind of ['missing', 'replaced', 'expired', 'closed']) {
    const h = ownedPool(t, { runId: 'guarded', parentAvailable: kind !== 'closed',
      leaseChanges: kind === 'replaced' ? { acquisition_id: randomUUID() } : kind === 'expired' ? { expires_at: bridgeNow } : {} });
    const store = createOperationRunStore({ getPoolFn: () => h.pool, operationType: 'library_scan' });
    const expectedLease = kind === 'missing' ? undefined : h.expectedLease;
    for (const action of ['markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunCancelled', 'markRunPaused']) {
      assert.equal(await store[action]({ runId: 'guarded', expectedLease, errorMessage: 'stale error' }), false, kind + '/' + action);
    }
    assert.equal(h.writes().length, 0, kind);
    assert.equal(h.pool.query.mock.callCount(), 0, kind);
  }
});

test('owned completion reports zero final writes as false and rolls back a thrown write failure', async (t) => {
  const zero = ownedPool(t, { runId: 'zero', writeResult: false });
  const zeroStore = createOperationRunStore({ getPoolFn: () => zero.pool, operationType: 'library_scan' });
  assert.equal(await zeroStore.markRunCompleted({ runId: 'zero', expectedLease: zero.expectedLease }), false);
  const failure = new Error('Controlled lifecycle write failure');
  const h = ownedPool(t, { runId: 'broken', writeError: failure });
  const store = createOperationRunStore({ getPoolFn: () => h.pool, operationType: 'library_scan' });
  await assert.rejects(store.markRunCompleted({ runId: 'broken', expectedLease: h.expectedLease }), (error) => error === failure);
  assert.equal(h.query.mock.calls.some((call) => call.arguments[0] === 'ROLLBACK'), true);
  assert.equal(h.query.mock.calls.some((call) => call.arguments[0] === 'COMMIT'), false);
  assert.equal(h.client.release.mock.callCount(), 1);
});
