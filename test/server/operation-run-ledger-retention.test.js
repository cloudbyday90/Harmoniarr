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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countPrunableOperationRuns,
  createOperationRunStore,
  pruneOperationRunsLedger,
} from '../../src/server/operation-run-store.js';

import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';

function createOwnedLedgerPool({ replacement = false } = {}) {
  const runId = '20000000-0000-4000-8000-000000000001';
  const expectedLease = createOperationRunLeaseFixture({ runId, jobType: 'artwork_cleanup' });
  const calls = [];
  const leaseRow = { id: expectedLease.id, job_type: expectedLease.jobType, lease_key: expectedLease.leaseKey,
    owner_instance_id: expectedLease.ownerInstanceId,
    acquisition_id: replacement ? '10000000-0000-4000-8000-000000000002' : expectedLease.acquisitionId,
    acquired_at: expectedLease.acquiredAt, expires_at: expectedLease.expiresAt, released_at: null };
  const client = { release: () => {}, query: async (text, params) => {
    calls.push({ text, params });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text) || text.includes('SELECT pg_advisory_xact_lock')) return { rows: [] };
    if (text.includes('SELECT clock_timestamp()')) return { rows: [{ observed_at: new Date('2026-10-09T21:00:00.000Z') }] };
    if (text.includes('FROM job_leases') && text.includes('FOR UPDATE')) return { rows: [leaseRow] };
    if (text.includes('FROM operation_runs') && text.includes('FOR UPDATE')) return { rows: [{
      id: runId, operation_type: 'artwork_cleanup', status: 'running', attempt_count: 1, max_attempts: 1, summary: {},
    }] };
    if (text.includes('UPDATE operation_runs')) return { rows: [{ id: runId }], rowCount: 1 };
    assert.fail('Unexpected owned lifecycle query: ' + text);
  } };
  const pool = { connect: async () => client,
    query: () => assert.fail('Terminal lifecycle and retry-budget reads must remain on their transaction client') };
  return { calls, expectedLease, runId, getPoolFn: () => pool };
}
function assertNoInlinePrune(pool) {
  assert.equal(pool.calls.some(({ text }) => /DELETE FROM operation_runs/u.test(text)), false);
  assert.equal(pool.calls.some(({ text }) => /\bprune\b/iu.test(text)), false);
}

function createFakePool(queryImpl) {
  const calls = [];
  return {
    calls,
    getPoolFn: () => ({
      query: async (text, params) => {
        calls.push({ params, text });
        return queryImpl ? queryImpl(text, params) : { rows: [], rowCount: 0 };
      },
    }),
  };
}

test('markRunCompleted no longer prunes the ledger inline', async () => {
  const pool = createOwnedLedgerPool();
  const store = createOperationRunStore({ getPoolFn: pool.getPoolFn, operationType: 'artwork_cleanup' });

  assert.equal(await store.markRunCompleted({ runId: pool.runId, expectedLease: pool.expectedLease, summary: { done: true } }), true);

  const updates = pool.calls.filter(({ text }) => text.includes('UPDATE operation_runs'));
  assert.equal(updates.length, 1);
  assert.match(updates[0].text, /status='completed'/u);
  assert.deepEqual(JSON.parse(updates[0].params[1]), { done: true });
  assertNoInlinePrune(pool);
});

test('markRunCancelled no longer prunes the ledger inline', async () => {
  const pool = createOwnedLedgerPool();
  const store = createOperationRunStore({ getPoolFn: pool.getPoolFn, operationType: 'artwork_cleanup' });

  assert.equal(await store.markRunCancelled({ runId: pool.runId, expectedLease: pool.expectedLease }), true);

  const updates = pool.calls.filter(({ text }) => text.includes('UPDATE operation_runs'));
  assert.equal(updates.length, 1);
  assert.match(updates[0].text, /status='cancelled'/u);
  assertNoInlinePrune(pool);
});

test('markRunFailed (terminal) no longer prunes the ledger inline', async () => {
  const pool = createOwnedLedgerPool();
  const store = createOperationRunStore({ getPoolFn: pool.getPoolFn, operationType: 'artwork_cleanup' });

  assert.equal(await store.markRunFailed({ runId: pool.runId, expectedLease: pool.expectedLease, errorMessage: 'boom' }), true);

  const updates = pool.calls.filter(({ text }) => text.includes('UPDATE operation_runs'));
  assert.equal(updates.length, 1);
  assert.match(updates[0].text, /status='failed'/u);
  assert.equal(updates[0].params[2], 'boom');
  assertNoInlinePrune(pool);
});

test('a replaced acquisition cannot finalize or prune any terminal ledger state', async () => {
  for (const action of ['markRunCompleted', 'markRunCancelled', 'markRunFailed']) {
    const pool = createOwnedLedgerPool({ replacement: true });
    const store = createOperationRunStore({ getPoolFn: pool.getPoolFn, operationType: 'artwork_cleanup' });
    assert.equal(await store[action]({ runId: pool.runId, expectedLease: pool.expectedLease, errorMessage: 'stale failure' }), false, action);
    assert.equal(pool.calls.some(({ text }) => text.includes('UPDATE operation_runs')), false, action);
    assertNoInlinePrune(pool);
  }
});

test('pruneOperationRunsLedger deletes terminal runs older than the cutoff with a per-type floor', async () => {
  const pool = createFakePool(() => ({ rows: [], rowCount: 4 }));

  const result = await pruneOperationRunsLedger({
    getPoolFn: pool.getPoolFn,
    olderThanIso: '2026-01-01T00:00:00.000Z',
    retainCountPerType: 50,
  });

  assert.equal(result.prunedCount, 4);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /DELETE FROM operation_runs/);
  assert.match(pool.calls[0].text, /PARTITION BY operation_type/);
  assert.equal(pool.calls[0].params[0], '2026-01-01T00:00:00.000Z');
  assert.equal(pool.calls[0].params[1], 50);
});

test('pruneOperationRunsLedger is a no-op without a cutoff and clamps the retain floor', async () => {
  const pool = createFakePool(() => ({ rows: [], rowCount: 9 }));

  const noop = await pruneOperationRunsLedger({ getPoolFn: pool.getPoolFn });
  assert.equal(noop.prunedCount, 0);
  assert.equal(pool.calls.length, 0);

  await pruneOperationRunsLedger({
    getPoolFn: pool.getPoolFn,
    olderThanIso: '2026-01-01T00:00:00.000Z',
    retainCountPerType: 0,
  });
  assert.equal(pool.calls[0].params[1], 1);
});

test('countPrunableOperationRuns counts without deleting', async () => {
  const pool = createFakePool(() => ({ rows: [{ prunable_count: 7 }] }));

  const result = await countPrunableOperationRuns({
    getPoolFn: pool.getPoolFn,
    olderThanIso: '2026-01-01T00:00:00.000Z',
    retainCountPerType: 25,
  });

  assert.equal(result.prunableCount, 7);
  assert.match(pool.calls[0].text, /SELECT COUNT\(\*\)/);
  assert.ok(!/DELETE/.test(pool.calls[0].text));
});

test('ledger pruning and its preview preserve runs backing durable external release approvals', async () => {
  const pool = createFakePool(() => ({ rows: [{ prunable_count: 0 }], rowCount: 0 }));
  const options = { getPoolFn: pool.getPoolFn, olderThanIso: '2026-09-01T00:00:00Z', retainCountPerType: 1 };
  await countPrunableOperationRuns(options);
  await pruneOperationRunsLedger(options);
  await createOperationRunStore({ getPoolFn: pool.getPoolFn, operationType: 'library_external_request_discovery' }).pruneOldRuns({ retainCount: 1 });
  assert.equal(pool.calls.length, 3);
  for (const { text } of pool.calls) {
    assert.match(text, /AND NOT EXISTS \(\s+SELECT 1 FROM library_external_request_release_intents retained_intent\s+WHERE retained_intent\.operation_run_id = operation_runs\.id\s+\)/);
  }
});
